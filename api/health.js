import { getSupabaseConfig } from './_lib/supabase.js';
import { jsonResponse } from './_lib/validation.js';

/**
 * Build a testable health handler bound to the provided environment.
 * @param {{ env?: Record<string, string | undefined> }} deps
 */
export function createHealthHandler({ env = process.env } = {}) {
  return async function handleHealth() {
    const supabase = getSupabaseConfig(env);
    return jsonResponse({
      ok: true,
      runtime: 'nodejs',
      supabaseConfigured: supabase.configured,
      timestamp: new Date().toISOString()
    });
  };
}

export async function GET(request) {
  return createHealthHandler()(request);
}
