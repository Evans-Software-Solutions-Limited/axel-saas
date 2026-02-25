import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase credentials. Auth will not work properly.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type { Session } from "@supabase/supabase-js";
