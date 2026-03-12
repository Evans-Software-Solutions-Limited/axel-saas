import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// In test environment, allow tests to run without env vars (they should mock supabase)
const isTest =
  import.meta.env.MODE === "test" || process.env.NODE_ENV === "test";

if (!supabaseUrl || !supabaseAnonKey) {
  if (isTest) {
    console.warn(
      "Warning: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. " +
        "Supabase client will be created with placeholder values for testing.",
    );
  } else {
    throw new Error(
      "Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set",
    );
  }
}

export const supabase = createClient(
  supabaseUrl || "https://test.supabase.co",
  supabaseAnonKey || "test-key",
);

export type { Session } from "@supabase/supabase-js";
