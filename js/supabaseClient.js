import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabaseUrl = 'https://neyxzaqxwbhndgzurfna.supabase.co'
const supabasekey = 'sb_publishable_VSiqjz91xYnkDwC3F-HPtg_Tl0WUhkE'
export const supabase = createClient(supabaseUrl, supabasekey);