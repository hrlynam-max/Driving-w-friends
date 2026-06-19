import { create } from 'zustand';
import type { Scene } from '@/lib/sceneTag';

export type Ping = {
  userId: string;
  handle: string;
  scene: Scene;
  label: string; // "JDM — 1997 RX-7 FD"
  lat: number;
  lng: number;
  heading: number | null;
  speedKph: number | null;
  meters: number; // distance from me
  updatedAt: number; // epoch ms, for TTL/interpolation
};

export type GateState = 'dormant' | 'active' | 'convoy';

type RadarState = {
  me: { lat: number; lng: number } | null;
  gate: GateState;
  pings: Record<string, Ping>; // keyed by userId
  convoyTargetId: string | null;

  setMe: (lat: number, lng: number) => void;
  setGate: (g: GateState) => void;
  upsertPing: (p: Ping) => void;
  removePing: (userId: string) => void;
  replacePings: (list: Ping[]) => void;
  pruneStale: (ttlMs?: number) => void;
  setConvoyTarget: (userId: string | null) => void;
};

export const useRadarStore = create<RadarState>((set, get) => ({
  me: null,
  gate: 'dormant',
  pings: {},
  convoyTargetId: null,

  setMe: (lat, lng) => set({ me: { lat, lng } }),
  setGate: (gate) => set({ gate }),

  upsertPing: (p) => set((s) => ({ pings: { ...s.pings, [p.userId]: p } })),

  removePing: (userId) =>
    set((s) => {
      const next = { ...s.pings };
      delete next[userId];
      return { pings: next };
    }),

  replacePings: (list) =>
    set(() => ({ pings: Object.fromEntries(list.map((p) => [p.userId, p])) })),

  pruneStale: (ttlMs = 90_000) =>
    set((s) => {
      const cutoff = Date.now() - ttlMs;
      const next: Record<string, Ping> = {};
      for (const [id, p] of Object.entries(s.pings)) {
        if (p.updatedAt >= cutoff) next[id] = p;
      }
      return { pings: next };
    }),

  setConvoyTarget: (convoyTargetId) => set({ convoyTargetId }),
}));

export const selectPingList = (s: RadarState) =>
  Object.values(s.pings).sort((a, b) => a.meters - b.meters);
export const selectConvoyTarget = (s: RadarState) =>
  s.convoyTargetId ? s.pings[s.convoyTargetId] ?? null : null;
