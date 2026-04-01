import { createClient } from '@supabase/supabase-js@supabase/supabase-js'
const supabaseUrl = process.env.SUPABASE_URL
const supabasekey = process.env.SUPABASE_KEY 
export const supabase = createClient(supabaseUrl, supabasekey);