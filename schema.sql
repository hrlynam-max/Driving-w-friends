-- Overdrive — PostgreSQL + PostGIS schema
-- Target: Supabase (uses auth.users for identity). Runnable as a migration.
-- See ARCHITECTURE.md for the rationale behind each design choice.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. VEHICLE CATALOG (curated reference data: Make -> Model -> Generation)
-- ============================================================================

CREATE TABLE makes (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name     TEXT NOT NULL UNIQUE,            -- "BMW", "Mazda"
    country  TEXT,                            -- "Germany" / "Japan" -> scene tag
    logo_url TEXT
);

CREATE TABLE models (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    make_id BIGINT NOT NULL REFERENCES makes(id) ON DELETE CASCADE,
    name    TEXT NOT NULL,                    -- "4-Series", "RX-7"
    UNIQUE (make_id, name)
);

CREATE TABLE generations (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_id     BIGINT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,               -- "G82 M4", "FD"
    chassis_code TEXT,                         -- "G82", "FD3S"
    year_start   SMALLINT,
    year_end     SMALLINT,                     -- NULL = still produced
    body_style   TEXT,
    UNIQUE (model_id, name)
);

CREATE INDEX models_make_idx       ON models (make_id);
CREATE INDEX generations_model_idx ON generations (model_id);

-- ============================================================================
-- 2. USERS & VEHICLES
-- ============================================================================

CREATE TABLE users (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle         TEXT UNIQUE NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_discoverable BOOLEAN NOT NULL DEFAULT true,   -- global visibility switch
    ghost_mode      BOOLEAN NOT NULL DEFAULT false   -- see, but not be seen
);

CREATE TABLE vehicles (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generation_id BIGINT NOT NULL REFERENCES generations(id),
    nickname      TEXT,
    color         TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one active vehicle per user.
CREATE UNIQUE INDEX one_active_vehicle_per_user
    ON vehicles (owner_id) WHERE is_active;
CREATE INDEX vehicles_owner_idx ON vehicles (owner_id);

-- ============================================================================
-- 3. LIVE LOCATIONS (hot, current-state-only, obfuscated)
-- ============================================================================

CREATE TABLE live_locations (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id BIGINT REFERENCES vehicles(id),
    -- Store the OBFUSCATED point (snapped ~50m grid). Raw GPS is never stored.
    geog       GEOGRAPHY(POINT, 4326) NOT NULL,
    heading    SMALLINT,                       -- 0-359 for marker arrow
    speed_kph  SMALLINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 seconds'
);

CREATE INDEX live_locations_geog_gix    ON live_locations USING GIST (geog);
CREATE INDEX live_locations_expires_idx ON live_locations (expires_at);

-- ============================================================================
-- 4. SERVER-SIDE OBFUSCATION + PROXIMITY RPC
-- ============================================================================

-- Snap any point to a ~grid_m grid so a tampered client can't post precision.
-- Re-applied server-side on every write.
CREATE OR REPLACE FUNCTION snap_to_grid(lng DOUBLE PRECISION,
                                        lat DOUBLE PRECISION,
                                        grid_m INTEGER DEFAULT 50)
RETURNS GEOGRAPHY LANGUAGE sql IMMUTABLE AS $$
    -- approx degrees per metre at the equator; good enough for privacy snapping
    WITH d AS (SELECT grid_m / 111320.0 AS deg)
    SELECT ST_SetSRID(
        ST_MakePoint(round(lng / deg) * deg, round(lat / deg) * deg), 4326
    )::geography
    FROM d;
$$;

-- Upsert the caller's location, always obfuscated, with a fresh TTL.
CREATE OR REPLACE FUNCTION upsert_my_location(p_vehicle_id BIGINT,
                                              p_lng DOUBLE PRECISION,
                                              p_lat DOUBLE PRECISION,
                                              p_heading SMALLINT DEFAULT NULL,
                                              p_speed SMALLINT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO live_locations (user_id, vehicle_id, geog, heading, speed_kph,
                                updated_at, expires_at)
    VALUES (auth.uid(), p_vehicle_id, snap_to_grid(p_lng, p_lat),
            p_heading, p_speed, now(), now() + INTERVAL '90 seconds')
    ON CONFLICT (user_id) DO UPDATE
        SET vehicle_id = EXCLUDED.vehicle_id,
            geog       = EXCLUDED.geog,
            heading    = EXCLUDED.heading,
            speed_kph  = EXCLUDED.speed_kph,
            updated_at = now(),
            expires_at = now() + INTERVAL '90 seconds';
END;
$$;

-- Everyone near me, still fresh, discoverable. Returns the derived display tag.
CREATE OR REPLACE FUNCTION radar_nearby(p_lng DOUBLE PRECISION,
                                        p_lat DOUBLE PRECISION,
                                        p_radius_m INTEGER DEFAULT 3000)
RETURNS TABLE (
    user_id    UUID,
    handle     TEXT,
    make       TEXT,
    model      TEXT,
    generation TEXT,
    year_start SMALLINT,
    country    TEXT,
    heading    SMALLINT,
    speed_kph  SMALLINT,
    meters     DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    SELECT ll.user_id, u.handle, mk.name, md.name, g.name, g.year_start,
           mk.country, ll.heading, ll.speed_kph,
           ST_Distance(ll.geog, ST_MakePoint(p_lng, p_lat)::geography) AS meters
    FROM live_locations ll
    JOIN users u       ON u.id = ll.user_id AND u.is_discoverable AND NOT u.ghost_mode
    JOIN vehicles v    ON v.id = ll.vehicle_id
    JOIN generations g ON g.id = v.generation_id
    JOIN models md     ON md.id = g.model_id
    JOIN makes mk      ON mk.id = md.make_id
    WHERE ll.expires_at > now()
      AND ll.user_id <> auth.uid()
      AND ST_DWithin(ll.geog, ST_MakePoint(p_lng, p_lat)::geography, p_radius_m)
    ORDER BY meters
    LIMIT 100;
$$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;

-- Catalog tables are public read-only reference data.
ALTER TABLE makes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE models      ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_read_makes  ON makes       FOR SELECT USING (true);
CREATE POLICY catalog_read_models ON models      FOR SELECT USING (true);
CREATE POLICY catalog_read_gens   ON generations FOR SELECT USING (true);

-- Users: read public profiles, write only your own row.
CREATE POLICY users_read   ON users FOR SELECT USING (true);
CREATE POLICY users_update ON users FOR UPDATE USING (id = auth.uid());

-- Vehicles: owners manage their own; others may read (for ping display).
CREATE POLICY vehicles_read  ON vehicles FOR SELECT USING (true);
CREATE POLICY vehicles_write ON vehicles FOR ALL
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Live locations: you only ever write your own row (via the RPC, which snaps).
-- Reads go through radar_nearby(), so no broad SELECT policy is granted.
CREATE POLICY live_self_write ON live_locations FOR ALL
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 6. REAP EXPIRED PINGS (schedule via pg_cron, e.g. every minute)
-- ============================================================================
-- SELECT cron.schedule('reap-locations', '* * * * *',
--   $$DELETE FROM live_locations WHERE expires_at < now()$$);
