// Live "Join Convoy" routing: debounced Mapbox Directions that re-route as the
// target (or you) move, capped so we don't hammer the API or the battery.
import { useEffect, useRef, useState } from 'react';
import { useRadarStore, selectConvoyTarget } from '@/store/radarStore';
import { fetchRoute, type Route } from '@/services/routing';
import { distanceMeters } from '@/services/geo';

const REROUTE_MIN_INTERVAL_MS = 5000;
const REROUTE_MIN_DRIFT_M = 50;

export function useConvoy() {
  const me = useRadarStore((s) => s.me);
  const target = useRadarStore(selectConvoyTarget);
  const [route, setRoute] = useState<Route | null>(null);

  const lastRouteAt = useRef(0);
  const lastTargetAt = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!me || !target) {
      setRoute(null);
      return;
    }
    const now = Date.now();
    const drift = lastTargetAt.current
      ? distanceMeters(lastTargetAt.current, { lat: target.lat, lng: target.lng })
      : Infinity;

    const tooSoon = now - lastRouteAt.current < REROUTE_MIN_INTERVAL_MS;
    const tooSmall = drift < REROUTE_MIN_DRIFT_M && route != null;
    if (tooSoon || tooSmall) return;

    lastRouteAt.current = now;
    lastTargetAt.current = { lat: target.lat, lng: target.lng };
    let active = true;
    fetchRoute({ lng: me.lng, lat: me.lat }, { lng: target.lng, lat: target.lat }).then((r) => {
      if (active) setRoute(r);
    });
    return () => {
      active = false;
    };
  }, [me?.lat, me?.lng, target?.lat, target?.lng, route]);

  return { route, target };
}
