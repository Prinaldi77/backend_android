const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is missing in environment variables. Database operations will fail.");
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

module.exports = supabase;
