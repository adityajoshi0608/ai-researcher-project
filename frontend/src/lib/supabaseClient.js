import { createClient } from '@supabase/supabase-js';

// Get the Supabase URL and Anon Key from the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if the variables are sets
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing from .env.local. Make sure the file exists and the variables start with NEXT_PUBLIC_");
}

// Create and export the Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);