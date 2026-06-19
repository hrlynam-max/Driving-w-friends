// The battery-aware core. Owns the GPS subscription and the ACTIVITY GATE:
//
//   dormant  -> GPS OFF. Only a low-power geofence bubble is armed. We are
//               invisible (our ping TTL lapses server-side).
//   active   -> continuous high-accuracy GPS (~4s / 15m), obfuscated + throttled,
//               published to presence + written-behind to Postgres.
//   convoy   -> faster cadence (~1.5s) while a Link-Up is in progress.
//
// "Not much action" forces dormant: you're not looking at the radar (app
// backgrounded / another tab), OR you've been parked past STATIONARY_TIMEOUT.
// Either way the GPS is cut; the geofence bubble re-wakes you when you drive off.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocationObject } from 'expo-location';
import { useRadarStore, type GateState } from '@/store/radarStore';
import { snapToGrid, distanceMeters } from '@/services/geo';
import {
  PROFILE,
  armGeofence,
  disarmGeofence,
  getCurrent,
  setWakeHandler,
  startWatch,
  type WatchHandle,
} from '@/services/location';

const STATIONARY_TIMEOUT_MS = 120_000; // 2 min parked -> dormant
const WRITE_BEHIND_MS = 12_000; // durable Postgres upsert cadence
const MIN_MOVE_M = 15; // skip emits below this (red-light filter)

export type LocationManagerDeps = {
  // Are we actively looking at the radar? (foreground + radar tab focused)
  radarFocused: boolean;
  // Publish an obfuscated fix to realtime presence (fan-out, every emit).
  broadcast: (p: {
    lat: number;
    lng: number;
    heading: number | null;
    speedKph: number | null;
  }) => void;
  // Durable write-behind to Postgres (throttled).
  writeBehind: (p: {
    lat: number;
    lng: number;
    heading: number | null;
    speedKph: number | null;
  }) => void;
};

export function useLocationManager(deps: LocationManagerDeps) {
  const gate = useRadarStore((s) => s.gate);
  const setGate = useRadarStore((s) => s.setGate);
  const setMe = useRadarStore((s) => s.setMe);
  const convoyTargetId = useRadarStore((s) => s.convoyTargetId);

  // "parked" sticks once the stationary timeout fires, and only clears when the
  // geofence detects we've driven off — so we don't immediately flip back to active.
  const [parked, setParked] = useState(false);

  const watchRef = useRef<WatchHandle | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastMoveAtRef = useRef<number>(Date.now());
  const lastWriteAtRef = useRef<number>(0);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const stopWatch = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  // ---- Gate transitions -----------------------------------------------------
  const goDormant = useCallback(async () => {
    stopWatch();
    setGate('dormant');
    const me = useRadarStore.getState().me;
    if (me) await armGeofence(me.lat, me.lng); // arm wake bubble around last spot
  }, [setGate, stopWatch]);

  const goAwake = useCallback(
    async (next: GateState) => {
      await disarmGeofence();
      lastMoveAtRef.current = Date.now(); // fresh movement clock on wake
      setGate(next);
    },
    [setGate],
  );

  // Background geofence exit = the rider drove off -> wake to active.
  useEffect(() => {
    setWakeHandler(() => {
      setParked(false);
      if (useRadarStore.getState().gate === 'dormant') goAwake('active');
    });
    return () => setWakeHandler(null);
  }, [goAwake]);

  // ---- Decide the target gate from "how much action" ------------------------
  useEffect(() => {
    if (convoyTargetId) {
      if (gate !== 'convoy') goAwake('convoy');
      return;
    }
    const shouldBeActive = deps.radarFocused && !parked;
    if (shouldBeActive && gate === 'dormant') goAwake('active');
    if (!shouldBeActive && gate !== 'dormant') goDormant();
  }, [deps.radarFocused, parked, convoyTargetId, gate, goAwake, goDormant]);

  // ---- Run the GPS watch for the current gate -------------------------------
  useEffect(() => {
    if (gate === 'dormant') {
      stopWatch();
      return;
    }
    const profile = gate === 'convoy' ? PROFILE.convoy : PROFILE.active;
    let cancelled = false;

    const onFix = (loc: LocationObject) => {
      const { latitude, longitude, heading, speed } = loc.coords;
      const snapped = snapToGrid(longitude, latitude);
      setMe(snapped.lat, snapped.lng);

      // Distance gate: skip near-duplicate emits (idling at a light).
      const last = lastSentRef.current;
      const moved = last ? distanceMeters(last, snapped) : Infinity;
      const now = Date.now();
      if (moved >= MIN_MOVE_M) {
        lastMoveAtRef.current = now;
        lastSentRef.current = snapped;
        const payload = {
          lat: snapped.lat,
          lng: snapped.lng,
          heading: heading ?? null,
          speedKph: speed != null && speed >= 0 ? Math.round(speed * 3.6) : null,
        };
        depsRef.current.broadcast(payload); // every meaningful move
        if (now - lastWriteAtRef.current >= WRITE_BEHIND_MS) {
          lastWriteAtRef.current = now;
          depsRef.current.writeBehind(payload); // throttled durable write
        }
      }

      // Parked too long (and not in a convoy) -> sleep until we move again.
      if (gate !== 'convoy' && now - lastMoveAtRef.current > STATIONARY_TIMEOUT_MS) {
        setParked(true);
      }
    };

    startWatch(profile, onFix).then((handle) => {
      if (cancelled) handle.remove();
      else watchRef.current = handle;
    });

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [gate, setMe, stopWatch]);

  // Seed an initial position once so the gate has somewhere to arm the bubble.
  useEffect(() => {
    getCurrent()
      .then((loc) => {
        const s = snapToGrid(loc.coords.longitude, loc.coords.latitude);
        setMe(s.lat, s.lng);
      })
      .catch(() => {});
  }, [setMe]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  return { gate };
}
