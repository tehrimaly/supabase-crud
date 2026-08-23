import { createClient } from "@supabase/supabase-js";

// This client uses the service_role key and must ONLY ever be imported
// inside app/api/** route handlers (server-side). Never import this into
// a "use client" component or it would leak the secret key to the browser.

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
export const BUCKET_NAME = process.env.SUPABASE_BUCKET || "user-files";
