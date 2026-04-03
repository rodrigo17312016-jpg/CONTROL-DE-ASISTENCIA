import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rslzosmeteyzxmgfkppe.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isOnline(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
}
