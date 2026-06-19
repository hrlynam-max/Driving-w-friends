// Realtime radar via Supabase Presence, sharded by coarse region cell.
// Presence carries the ephemeral live stream (fan-out, no DB write per tick);
// Postgres + radar_nearby() seeds the initial/durable view.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { regionCell } from './geo';
import type { Scene } from '@/lib/sceneTag';

export type PresencePayload = {
  userId: string;
  handle: string;
  scene: Scene;
  label: string;
  lat: number; // already obfuscated (snapped) before broadcast
  lng: number;
  heading: number | null;
  speedKph: number | null;
  at: number;
};

export type PresenceHandlers = {
  onSync: (members: PresencePayload[]) => void;
  onLeave: (userId: string) => void;
};

export class RadarChannel {
  private channel: RealtimeChannel | null = null;
  private cell: string | null = null;

  constructor(private readonly handlers: PresenceHandlers) {}

  /** Join the channel for the cell containing (lng,lat). Re-joins on cell change. */
  async ensureCell(lng: number, lat: number, selfKey: string) {
    const cell = regionCell(lng, lat);
    if (cell === this.cell && this.channel) return;
    await this.leave();
    this.cell = cell;

    const channel = supabase.channel(`radar:${cell}`, {
      config: { presence: { key: selfKey } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const members: PresencePayload[] = [];
        for (const entries of Object.values(state)) {
          const latest = entries[entries.length - 1];
          if (latest) members.push(latest);
        }
        this.handlers.onSync(members);
      })
      .on('presence', { event: 'leave' }, ({ key }) => this.handlers.onLeave(key));

    await channel.subscribe();
    this.channel = channel;
  }

  /** Publish our obfuscated position to the current cell. */
  async track(payload: PresencePayload) {
    if (!this.channel) return;
    await this.channel.track(payload);
  }

  async leave() {
    if (this.channel) {
      await this.channel.untrack().catch(() => {});
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
