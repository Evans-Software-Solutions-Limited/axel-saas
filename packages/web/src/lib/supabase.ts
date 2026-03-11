import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://example.supabase.co";
const fallbackSupabaseAnonKey = "test-anon-key";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type { Session } from "@supabase/supabase-js";
