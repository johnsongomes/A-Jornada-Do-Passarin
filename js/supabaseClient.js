import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabaseUrl = process.env.SUPABASE_URL
const supabasekey = process.env.SUPABASE_KEY 
export const supabase = createClient(supabaseUrl, supabasekey);