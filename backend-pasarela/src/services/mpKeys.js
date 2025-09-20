// backend-pasarela/src/services/mpKeys.js
import { supabase } from './supabase.js';

export async function getMpKeysForRestaurant(restaurantId) {
  const rid = Number(restaurantId || 0);
  if (!rid) return { publicKey: null, accessToken: null };

  const { data, error } = await supabase
    .from('psp_credentials')
    .select('public_key, secret_key')
    .eq('restaurant_id', rid)
    .eq('provider', 'mercadopago')
    .eq('active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    publicKey: (data?.public_key || '').trim() || null,
    accessToken: (data?.secret_key || '').trim() || null,
  };
}
