/**
 * Resolve Supabase project URL and publishable key from environment variables.
 * @param {Record<string, string | undefined>} env
 */
export function getSupabaseConfig(env = process.env) {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  return {
    configured: Boolean(url && key),
    url,
    key
  };
}

/**
 * Create a minimal PostgREST and RPC client over native fetch for Serverless Functions.
 */
export function createSupabaseClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = getSupabaseConfig(env);

  async function requestJson(path, init = {}) {
    if (!config.configured) {
      const err = new Error('Konfigurasi Supabase belum tersedia.');
      err.status = 503;
      err.code = 'SUPABASE_UNCONFIGURED';
      throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          Accept: 'application/json',
          ...(init.headers || {})
        }
      });

      const rawText = await response.text();
      let parsed = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = { message: rawText };
        }
      }

      if (!response.ok) {
        const err = new Error(parsed?.message || `Supabase HTTP ${response.status}`);
        err.status = response.status;
        err.code = parsed?.code || 'SUPABASE_HTTP_ERROR';
        throw err;
      }

      return parsed;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    configured: config.configured,
    selectRows(table, queryString) {
      return requestJson(`${table}?${queryString}`, { method: 'GET' });
    },
    rpc(fnName, params) {
      return requestJson(`rpc/${fnName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    }
  };
}
