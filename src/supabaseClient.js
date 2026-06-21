import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error(
    "Supabase is not configured. Copy .env.example to .env and add your " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart `npm run dev`."
  );
}

// When unconfigured we still create a client with placeholders so imports don't
// crash; the app shows a setup screen instead of calling it.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-key"
);
