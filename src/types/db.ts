// Hand-written DB types matching supabase/migrations/0001_init.sql.
// Regenerate with: supabase gen types typescript --local > src/types/db.ts

export type RiderVisibility = 'public' | 'private';

export type Make = { id: number; name: string; country: string | null; logo_url: string | null };
export type Model = { id: number; make_id: number; name: string };
export type Generation = {
  id: number;
  model_id: number;
  name: string;
  chassis_code: string | null;
  year_start: number | null;
  year_end: number | null;
  body_style: string | null;
};

export type User = {
  id: string;
  handle: string;
  created_at: string;
  visibility: RiderVisibility;
};

export type Vehicle = {
  id: number;
  owner_id: string;
  generation_id: number;
  nickname: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
};

// Shape returned by the radar_nearby() RPC.
export type RadarRow = {
  user_id: string;
  handle: string;
  make: string;
  model: string;
  generation: string;
  year_start: number | null;
  country: string | null;
  heading: number | null;
  speed_kph: number | null;
  meters: number;
};

// Minimal Database typing so supabase-js generics resolve.
export type Database = {
  public: {
    Tables: {
      makes: { Row: Make; Insert: Partial<Make>; Update: Partial<Make> };
      models: { Row: Model; Insert: Partial<Model>; Update: Partial<Model> };
      generations: { Row: Generation; Insert: Partial<Generation>; Update: Partial<Generation> };
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> };
      vehicles: { Row: Vehicle; Insert: Partial<Vehicle>; Update: Partial<Vehicle> };
    };
    Functions: {
      radar_nearby: {
        Args: { p_lng: number; p_lat: number; p_radius_m?: number };
        Returns: RadarRow[];
      };
      upsert_my_location: {
        Args: {
          p_vehicle_id: number;
          p_lng: number;
          p_lat: number;
          p_heading?: number | null;
          p_speed?: number | null;
        };
        Returns: undefined;
      };
    };
  };
};
