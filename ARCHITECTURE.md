# Overdrive — Technical Architecture

> Real-time, location-based app for the underground car community.
> Dark UI, neon accents, late-night, high-performance.

This document covers three things the product brief asked for:

1. [Tech stack recommendation](#1-tech-stack)
2. [Database schema](#2-database-schema) (the Make → Model → Chassis hierarchy + live location)
3. [Component breakdown](#3-component-breakdown--battery-aware-location-pipeline) — how to do high-frequency location without melting the phone

A short but important **[privacy & safety](#4-privacy--safety-non-negotiables)** section is included because a "find cars near me at night" app has a real-world stalking/safety surface that has to be designed in from day one, not bolted on.

---

## 1. Tech Stack

### Recommendation: React Native (Expo) + Supabase

| Layer | Choice | Why |
|---|---|---|
| **Client** | **React Native + Expo (dev client)** | One codebase, near-native maps/location, huge ecosystem. Expo's config plugins let you use native modules (background location, Mapbox) without ejecting. |
| **Maps** | **Mapbox** (`@rnmapbox/maps`) | Best-in-class *custom dark styling* (Mapbox Studio), vector tiles, smooth marker animation, cheaper at scale than Google for high map-load volume. Google Maps is the fallback if you need Street View / their POI data. |
| **Realtime + Backend** | **Supabase** | Postgres + **PostGIS** (geospatial is the whole app) + Realtime (WebSocket broadcast/presence) + Row Level Security + Auth in one box. This is the deciding factor below. |
| **Hot path / fan-out** | **Supabase Realtime "Presence" + "Broadcast"** channels, backed by Postgres for durable state | Ephemeral location pings should *not* all hit Postgres on every update — see §3. |
| **Routing** | **Mapbox Directions API** (or Valhalla self-hosted later) | Turn-by-turn + live re-route for "Join Convoy." |
| **Push** | **Expo Notifications** → APNs/FCM | "A G82 M4 just pinged near you." |

### Why Supabase over Firebase here

The core of this app is a **geospatial proximity query** ("who is within N meters of me, moving"). That is a `ST_DWithin` query in PostGIS — trivial, indexed, and fast in Postgres. Firebase/Firestore has **no native geo radius query**; you bolt on geohash libraries (GeoFirestore) and it gets awkward and expensive as write volume climbs. The vehicle catalog is also strongly relational (Make→Model→Generation), which is a Postgres sweet spot and a NoSQL anti-pattern.

So: **Supabase = Postgres (relational vehicle catalog + PostGIS proximity) + Realtime (live pings) + Auth + RLS (privacy) in a single product.** That alignment is why it wins for this specific app.

### Why React Native over Flutter / native

- **vs. native (Swift/Kotlin):** Native is the gold standard for background location and battery, but doubles your build cost. For a v1 you do not need it — Expo's native location modules are good enough, and you can drop to a native module for the one hot path (background location) if needed.
- **vs. Flutter:** Flutter is excellent and a defensible choice. RN wins here mainly on ecosystem maturity for **Mapbox** and on team hireability. If your team already knows Dart, Flutter + Supabase is equally valid.

---

## 2. Database Schema

Postgres + PostGIS. The full runnable DDL is in [`schema.sql`](./schema.sql); this section explains the design.

### 2.1 The vehicle catalog (reference data — Make → Model → Generation)

This is **curated reference data**, shared by all users and read-only to them. Normalize it into three tables so the picker is a clean hierarchical drill-down and so "1997 RX-7 FD" is a real foreign key, not a free-text string.

```
makes (BMW)
  └─ models (4-Series)
       └─ generations (G82 M4, 2021–present, chassis_code 'G82')
```

```sql
CREATE TABLE makes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,         -- "BMW"
  country     TEXT,                          -- "Germany" (powers the Euro/JDM/USDM tag)
  logo_url    TEXT
);

CREATE TABLE models (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  make_id     BIGINT NOT NULL REFERENCES makes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- "4-Series" / "RX-7"
  UNIQUE (make_id, name)
);

CREATE TABLE generations (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id      BIGINT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,               -- "G82 M4"
  chassis_code  TEXT,                         -- "G82" / "FD3S"
  year_start    SMALLINT,
  year_end      SMALLINT,                     -- NULL = still in production
  body_style    TEXT,
  UNIQUE (model_id, name)
);
```

> **Why three tables and not one with a `parent_id` self-reference?** A fixed 3-level hierarchy is known and shallow. Explicit tables give you clean foreign keys, simple `JOIN`s for the picker, and per-level metadata (a chassis code belongs to a generation, a country belongs to a make). Reserve adjacency-list/`ltree` for *unbounded* depth — you don't have that here.

### 2.2 Users & their active ride

```sql
-- Public  = your ping is shown to ANYONE using the app (the open radar).
-- Private = hidden from the public radar (you can still see others).
CREATE TYPE rider_visibility AS ENUM ('public', 'private');

CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id),  -- Supabase Auth
  handle        TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  visibility    rider_visibility NOT NULL DEFAULT 'public'   -- public | private
);

-- A user can own several cars but flies one "active" at a time.
CREATE TABLE vehicles (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation_id  BIGINT NOT NULL REFERENCES generations(id),
  nickname       TEXT,                         -- "the FD"
  color          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Exactly one active vehicle per user:
CREATE UNIQUE INDEX one_active_vehicle_per_user
  ON vehicles (owner_id) WHERE is_active;
```

The **display tag** ("Euro — 2021 M4", "JDM — 1997 RX-7 FD") is *derived*, not stored: join `vehicles → generations → models → makes`, and map `makes.country` → scene tag (Germany→Euro, Japan→JDM, USA→USDM…). Store it as a generated/cached column only if profiling says the join is hot.

### 2.3 Live locations (the hot table — PostGIS)

Keep this table **narrow and current-state only** (one row per user, upserted), not an append log. History, if you ever want it, goes to a separate partitioned table or is left in the realtime layer entirely.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE live_locations (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id     BIGINT REFERENCES vehicles(id),
  -- PRIVACY: store the OBFUSCATED point (snapped to a ~50m grid), never the raw GPS fix.
  geog           GEOGRAPHY(POINT, 4326) NOT NULL,
  heading        SMALLINT,                     -- 0–359, for the marker arrow
  speed_kph      SMALLINT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 seconds'
);

-- The index that makes proximity fast:
CREATE INDEX live_locations_geog_gix ON live_locations USING GIST (geog);
CREATE INDEX live_locations_expires_idx ON live_locations (expires_at);
```

**The proximity query** (everyone near me, still fresh, who is discoverable):

```sql
-- :lng, :lat = the CALLER'S obfuscated point; :radius_m e.g. 3000
SELECT ll.user_id, ll.heading, ll.speed_kph,
       mk.name AS make, md.name AS model, g.name AS generation,
       g.year_start, mk.country,
       ST_Distance(ll.geog, ST_MakePoint(:lng, :lat)::geography) AS meters
FROM live_locations ll
JOIN users u   ON u.id = ll.user_id AND u.visibility = 'public'  -- private riders hidden
JOIN vehicles v        ON v.id = ll.vehicle_id
JOIN generations g     ON g.id = v.generation_id
JOIN models md         ON md.id = g.model_id
JOIN makes mk          ON mk.id = md.make_id
WHERE ll.expires_at > now()
  AND ST_DWithin(ll.geog, ST_MakePoint(:lng, :lat)::geography, :radius_m)
ORDER BY meters
LIMIT 100;
```

`ST_DWithin` on a `GEOGRAPHY` GIST index is the whole reason to pick Postgres. Expired rows (no update in 90s) are invisible and reaped by a cron.

---

## 3. Component Breakdown & Battery-Aware Location Pipeline

The single biggest engineering risk in this app is **draining the battery and saturating the network** by naively streaming raw GPS at high frequency. The fix is a layered pipeline where each layer reduces the rate.

```
┌─────────────────────────── DEVICE (React Native) ───────────────────────────┐
│                                                                              │
│  [Geofence / significant-change watcher]  ◄── default: GPS OFF (dormant)     │
│      │  wakes only on real movement / nearby action                          │
│      ▼                                                                        │
│  [GPS Sensor]  (spun up only while awake; see state table)                   │
│      │  adaptive sample rate                                                  │
│      ▼                                                                        │
│  LocationManager ── ACTIVITY GATE (off when "not much action")               │
│      │              └─ obfuscate (snap ~50m grid) ── dedupe ── throttle       │
│      │                                                                        │
│      ▼  only on MEANINGFUL change                                            │
│  RealtimeClient ──(WebSocket, single channel)──┐                             │
│                                                 │                            │
│  RadarStore (Zustand) ◄── interpolate markers ──┘  ◄──── inbound pings       │
│      │                                                                        │
│      ▼                                                                        │
│  MapView (Mapbox, dark style)   RouteEngine (Mapbox Directions, debounced)   │
└──────────────────────────────────────────────────────────────────────────────┘
                              │ presence / broadcast
                              ▼
┌──────────────────────────── SUPABASE ────────────────────────────────────────┐
│  Realtime (Presence channel: ephemeral live pings, fan-out)                   │
│  Postgres + PostGIS  (durable state, ST_DWithin proximity, RLS privacy)       │
│  Edge Function: obfuscation re-check + write-behind upsert + route proxy      │
│  pg_cron: reap expired live_locations                                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Battery strategy — the techniques that actually matter

1. **Sample only when there's action — otherwise the GPS is OFF.** The location stream is not a constant background drip with a slow floor; it has a true **dormant (OFF)** state and only spins up when there's a reason to. Drive the mode from context:

   | State | GPS | Broadcast cadence |
   |---|---|---|
   | **Dormant — "not much action"** (app backgrounded, *or* foreground but no nearby riders, *or* stationary past a timeout) | **OFF** | **None.** Stop the location subscription entirely; ping `expires_at` lapses and you drop off others' radar. |
   | Wake trigger | low-power **geofence / significant-location-change** only | event-driven (cheap OS callback, no continuous GPS) |
   | Foreground, on the Radar, moving | `high` accuracy | ~3–5 s |
   | **Active convoy (Link-Up in progress)** | `high` accuracy | ~1–2 s |

   The default is **off**. A lightweight geofence/significant-change watcher (an OS-level callback, not continuous GPS) is the only thing running while dormant; it wakes the full pipeline when the rider actually starts moving, enters an area with active pings, or taps into the Radar. Only the small slice of users *actively in a convoy* runs the expensive 1–2s stream.

   "Not much action" is concretely: app not foregrounded on the Radar, **or** zero discoverable riders within the radius, **or** stationary longer than a timeout (e.g. ~2 min). Any of those → kill the location subscription.

2. **Distance filter before time filter.** Don't emit if the device moved < ~15m since the last sent point (`distanceFilter` on the location module). A car at a red light sends nothing.

3. **Obfuscate + snap on-device → free deduplication.** Snapping the fix to a ~50m grid (privacy requirement) *also* means small jitters collapse to the same cell and never transmit. Privacy and battery win together. (Re-validate the snap server-side in an Edge Function so a hacked client can't post a precise point.)

4. **Ephemeral pings over Realtime Presence, not a DB write per tick.** Streaming every 2s position into Postgres for thousands of users is a write storm. Instead broadcast live positions over a **Supabase Realtime Presence channel** (in-memory fan-out), and **write-behind** to `live_locations` only every ~10–15s (or on meaningful change) for durability and proximity seeding. Postgres holds *state*; Realtime carries the *stream*.

5. **Interpolate on the receiver, don't demand more packets.** Animate other cars' markers smoothly between sparse updates (lerp position + heading over the expected interval). The map looks 60fps while the network sees one packet every few seconds.

6. **Geofenced radar.** Subscribe only to pings within the current map viewport / radius. Pan or zoom → re-subscribe. You never receive the whole city.

7. **Coalesce & debounce routing.** "Join Convoy" re-routes on movement, but cap Directions API calls (e.g., re-route at most every ~5s or every ~50m of target drift) and snap-to-roads client-side in between. Protects battery *and* your API bill.

8. **Always set TTLs.** `expires_at` (§2.3) means a user who closes the app or loses signal simply fades off everyone's radar within ~90s — no ghost pings, no manual cleanup.

### 3.2 Client component map

| Component | Responsibility |
|---|---|
| `RideSelector` | Drill-down picker Make→Model→Generation; writes active `vehicle`. |
| `LocationManager` | Owns OS location subscription, accuracy mode switching, obfuscation, distance/time throttling. Holds the **activity gate**: keeps GPS *off* by default and only spins it up on a wake trigger (movement / nearby pings / Radar focus); tears it back down when "not much action." The single source of "should we even be tracking, and should we emit?". |
| `RealtimeClient` | One WebSocket; presence join/track + broadcast; viewport (re)subscription. |
| `RadarStore` (Zustand/Jotai) | Holds nearby pings; runs marker interpolation; viewport state. |
| `MapView` | Mapbox dark style, animated car markers with heading arrows. |
| `LinkUpController` | Convoy session: bumps both clients to high-frequency mode, drives `RouteEngine`. |
| `RouteEngine` | Debounced Mapbox Directions calls; draws/updates the live path. |

---

## 4. Privacy & Safety (non-negotiables)

A "see cars near you, at night" app is a stalking/doxxing vector if built naively. Bake these in from v1:

- **Server-authoritative obfuscation.** The client snaps to a ~50m grid, but an **Edge Function re-snaps** on write so a tampered client cannot publish a precise coordinate. Raw GPS never leaves the device and is never stored.
- **Public vs Private is the core visibility control.** A **Public** rider's *obfuscated* ping is shown to anyone on the app (the open radar); a **Private** rider is hidden from the public radar but can still browse others (ghost behavior). Default is `public` so the radar feels alive, with a one-tap switch to `private`.
- **Row Level Security** on every table. Others' live locations are reachable only through `radar_nearby()`, which hard-filters to `visibility = 'public'`; users can write only their own rows. Vehicle ownership is enforced in RLS, not just the UI.
- **Mutual-consent precise routing.** "Join Convoy" should reveal tighter location to the *other party only after both accept* — not let anyone draw a live path to a stranger unilaterally. (This is also a product-trust feature, not just safety.)
- **Rate-limit & block/report** from day one; log abuse signals.
- **TTL everything** so leaving the app removes you from the map automatically.

---

## Suggested build order (v1)

1. Auth + `users` + the vehicle catalog tables, seeded with a starter dataset; ship the `RideSelector`.
2. `live_locations` + PostGIS + the `ST_DWithin` proximity RPC; static Radar (no realtime yet).
3. `LocationManager` with adaptive sampling + obfuscation; Realtime Presence fan-out; animated markers.
4. `LinkUpController` + `RouteEngine` (convoy mode + live routing).
5. Harden: RLS policies, ghost mode, rate limits, abuse tooling.
