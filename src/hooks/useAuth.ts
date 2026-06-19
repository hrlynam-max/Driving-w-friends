import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { User, Vehicle } from '@/types/db';

export type Profile = User & { activeVehicle: Vehicle | null };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading, userId: session?.user.id ?? null };
}

/** Sign in with email magic link / OTP. */
export async function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({ email });
}

export async function verifyOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/** Load the current user's profile + active vehicle, creating the row if needed. */
export async function loadProfile(userId: string, email?: string): Promise<Profile | null> {
  let { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

  if (!user) {
    const handle = (email?.split('@')[0] ?? `rider_${userId.slice(0, 6)}`).toLowerCase();
    const { data: created } = await supabase
      .from('users')
      .insert({ id: userId, handle })
      .select('*')
      .single();
    user = created ?? null;
  }
  if (!user) return null;

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  return { ...user, activeVehicle: vehicle ?? null };
}
