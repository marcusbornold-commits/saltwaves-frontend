import 'server-only';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let client: SupabaseClient | null = null;
export function audiobookStorageUrl() {
  const separate = !!(process.env.AUDIOBOOK_STORAGE_URL || process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY);
  const url = separate ? process.env.AUDIOBOOK_STORAGE_URL : process.env.SUPABASE_URL;
  const key = separate ? process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Audiobook storage configuration is incomplete');
  return {url,key};
}
export function getAudiobookStorage() {
  if (!client) {
    const {url,key}=audiobookStorageUrl();
    client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  return client;
}
