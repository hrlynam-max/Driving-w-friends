import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  mapboxPublicToken?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function required(value: string | undefined, name: string): string {
  if (!value || value.startsWith('PLACEHOLDER') || value.startsWith('PUT_YOUR')) {
    console.warn(`[config] Missing env value for ${name}. Set it in .env (see .env.example).`);
    return value ?? '';
  }
  return value;
}

export const config = {
  supabaseUrl: required(extra.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required(extra.supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  mapboxToken: required(extra.mapboxPublicToken, 'EXPO_PUBLIC_MAPBOX_TOKEN'),
};
