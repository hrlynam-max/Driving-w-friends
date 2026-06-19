import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { loadProfile, type Profile } from '@/hooks/useAuth';

type SessionContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  setProfileLocal: (patch: Partial<Profile>) => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function hydrate(s: Session | null) {
    setSession(s);
    if (s) {
      const p = await loadProfile(s.user.id, s.user.email ?? undefined);
      setProfile(p);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => hydrate(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: SessionContextValue = {
    session,
    profile,
    loading,
    refreshProfile: async () => {
      if (session) setProfile(await loadProfile(session.user.id, session.user.email ?? undefined));
    },
    setProfileLocal: (patch) => setProfile((p) => (p ? { ...p, ...patch } : p)),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
