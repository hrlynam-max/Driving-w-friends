# Overdrive

Real-time, location-based app for the underground car community. Dark UI, neon
accents, late-night, high-performance. Built with **Expo (React Native)** +
**Supabase (Postgres + PostGIS + Realtime)** + **Mapbox**.

> Architecture rationale lives in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
> The database design lives in [`schema.sql`](./schema.sql) /
> [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

## What it does

1. **Onboarding / ride selection** — drill-down picker `Make → Model → Generation`
   (e.g. `BMW → 4-Series → G82 M4`) sets your active ride.
2. **The Radar** — dark Mapbox map of nearby rides shown as pings tagged by scene
   (`JDM — 1997 RX-7 FD`). Your coordinate is obfuscated to a ~50m grid.
3. **The Link-Up** — tap a ping → *Join Convoy* → live Mapbox route that re-routes
   as both cars move.

Two product rules are baked in:
- **Public / Private visibility** — public riders appear on the open radar to
  anyone; private riders are hidden but can still browse.
- **Tracking turns OFF when there's no action** — the GPS is dormant by default
  and only wakes when you're on the radar and moving; a low-power geofence
  re-wakes it when you drive off.

## Project layout

```
app/                         Expo Router screens
  (auth)/sign-in.tsx         email OTP sign-in
  onboarding/ride-selector.tsx   Make -> Model -> Generation drill-down
  (tabs)/radar.tsx           the live radar (map + nearby sheet)
  (tabs)/garage.tsx          your rides; pick the active one
  (tabs)/profile.tsx         public/private toggle, sign out
  convoy/[userId].tsx        live convoy routing
src/
  lib/        config, supabase client, theme, scene tags
  services/   geo (obfuscation/sharding), location (gate+geofence), realtime, routing
  hooks/      useAuth, useLocationManager (the activity gate), useRadar, useConvoy
  store/      radarStore (zustand), SessionProvider
  components/ RadarMap, PingCard, NeonButton, GateBadge, VisibilityToggle
supabase/
  migrations/0001_init.sql   tables, PostGIS, RPCs, RLS
  seed.sql                   starter vehicle catalog
```

## Setup

### 1. Backend (Supabase)

```bash
# with the Supabase CLI + a linked project:
supabase db reset           # applies migrations/0001_init.sql then seed.sql
# enable the pg_cron job in 0001_init.sql to reap expired pings
```

Or paste `supabase/migrations/0001_init.sql` then `supabase/seed.sql` into the
Supabase SQL editor.

### 2. Env

```bash
cp .env.example .env
# fill in:
#   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
#   EXPO_PUBLIC_MAPBOX_TOKEN  (public pk.* token)
```

Also set your **Mapbox secret download token** in `app.json` under the
`@rnmapbox/maps` plugin (`RNMapboxMapsdownloadToken`) so the native SDK installs.

### 3. Run

Mapbox + background location need a **dev client** (not Expo Go):

```bash
npm install
npx expo prebuild          # generates native projects
npm run ios                # or: npm run android
```

`npm run lint` runs `tsc --noEmit`.

## Notes / next steps

- **Realtime model:** live pings fan out over a Supabase Presence channel sharded
  by ~5km region cell; Postgres + `radar_nearby()` seeds the durable view and the
  `live_locations` TTL (~90s) makes you fade off the radar when tracking stops.
- **Mutual-consent convoy:** the current Link-Up draws a route unilaterally. Per
  `ARCHITECTURE.md` §4, the next safety step is requiring both parties to accept
  before tighter location is shared.
- **Types:** `src/types/db.ts` is hand-written; regenerate with
  `supabase gen types typescript --local > src/types/db.ts` once linked.
- **Marker interpolation:** markers currently snap to each update; add lerp for
  buttery motion (see `ARCHITECTURE.md` §3.1).
