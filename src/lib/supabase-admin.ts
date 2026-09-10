import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-role-key";

const validUrl = supabaseUrl && supabaseUrl.startsWith("http")
  ? supabaseUrl
  : "https://placeholder.supabase.co";

export const supabaseAdmin = createClient(validUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
