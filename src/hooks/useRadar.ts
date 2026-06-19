// Ties the realtime presence channel + the radar_nearby() seed into the store,
// and hands broadcast/writeBehind callbacks to the LocationManager.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRadarStore } from '@/store/radarStore';
import { rideTag, type Scene } from '@/lib/sceneTag';
import { distanceMeters } from '@/services/geo';
import { RadarChannel, type PresencePayload } from '@/services/realtime';
import type { RadarRow } from '@/types/db';

export type SelfProfile = {
  userId: string;
  handle: string;
  scene: Scene;
  label: string;
  vehicleId: number;
  visibilityPublic: boolean;
};

const RADAR_RADIUS_M = 4000;

export function useRadar(self: SelfProfile | null) {
  const me = useRadarStore((s) => s.me);
  const upsertPing = useRadarStore((s) => s.upsertPing);
  const removePing = useRadarStore((s) => s.removePing);
  const replacePings = useRadarStore((s) => s.replacePings);
  const pruneStale = useRadarStore((s) => s.pruneStale);

  const channelRef = useRef<RadarChannel | null>(null);

  // Build/refresh the presence channel handlers.
  const channel = useMemo(() => {
    const ch = new RadarChannel({
      onSync: (members: PresencePayload[]) => {
        const mine = useRadarStore.getState().me;
        for (const m of members) {
          if (self && m.userId === self.userId) continue; // skip self
          upsertPing({
            userId: m.userId,
            handle: m.handle,
            scene: m.scene,
            label: m.label,
            lat: m.lat,
            lng: m.lng,
            heading: m.heading,
            speedKph: m.speedKph,
            meters: mine ? distanceMeters(mine, { lat: m.lat, lng: m.lng }) : 0,
            updatedAt: m.at,
          });
        }
      },
      onLeave: (userId) => removePing(userId),
    });
    channelRef.current = ch;
    return ch;
  }, [self, upsertPing, removePing]);

  // Initial durable seed via PostGIS proximity query.
  useEffect(() => {
    if (!me) return;
    let active = true;
    supabase
      .rpc('radar_nearby', { p_lng: me.lng, p_lat: me.lat, p_radius_m: RADAR_RADIUS_M })
      .then(({ data }) => {
        if (!active || !data) return;
        replacePings(
          (data as RadarRow[]).map((r) => {
            const { scene, label } = rideTag({
              country: r.country,
              make: r.make,
              model: r.model,
              generation: r.generation,
              yearStart: r.year_start,
            });
            return {
              userId: r.user_id,
              handle: r.handle,
              scene,
              label,
              lat: 0,
              lng: 0, // exact coords arrive via presence; meters comes from RPC
              heading: r.heading,
              speedKph: r.speed_kph,
              meters: r.meters,
              updatedAt: Date.now(),
            };
          }),
        );
      });
    return () => {
      active = false;
    };
    // re-seed only when the cell-level position changes materially
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.lat?.toFixed(2), me?.lng?.toFixed(2)]);

  // Keep the channel joined to the right region cell.
  useEffect(() => {
    if (!me || !self) return;
    channel.ensureCell(me.lng, me.lat, self.userId);
    return () => {
      channel.leave();
    };
  }, [channel, me?.lng, me?.lat, self]);

  // Prune stale pings every few seconds.
  useEffect(() => {
    const id = setInterval(() => pruneStale(), 5000);
    return () => clearInterval(id);
  }, [pruneStale]);

  // ---- Callbacks for the LocationManager ------------------------------------
  const broadcast = useCallback(
    (p: { lat: number; lng: number; heading: number | null; speedKph: number | null }) => {
      if (!self || !self.visibilityPublic) return; // private riders never broadcast
      const payload: PresencePayload = {
        userId: self.userId,
        handle: self.handle,
        scene: self.scene,
        label: self.label,
        lat: p.lat,
        lng: p.lng,
        heading: p.heading,
        speedKph: p.speedKph,
        at: Date.now(),
      };
      channel.track(payload);
    },
    [channel, self],
  );

  const writeBehind = useCallback(
    async (p: { lat: number; lng: number; heading: number | null; speedKph: number | null }) => {
      if (!self) return;
      await supabase.rpc('upsert_my_location', {
        p_vehicle_id: self.vehicleId,
        p_lng: p.lng,
        p_lat: p.lat,
        p_heading: p.heading,
        p_speed: p.speedKph,
      });
    },
    [self],
  );

  return { broadcast, writeBehind };
}
