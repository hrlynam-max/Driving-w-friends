import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import type { Database } from '@/types/db';

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // Keep the socket lean; we send sparse, throttled position updates.
    params: { eventsPerSecond: 4 },
  },
});
