import { createSupabaseClient } from './_lib/supabase.js';
import {
  extractClientIp,
  hashIpAddress,
  jsonResponse,
  validateContactPayload
} from './_lib/validation.js';

/**
 * Build a testable POST /api/contact handler that persists messages via Supabase RPC.
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} deps
 */
export function createContactHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async function handleContact(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { ok: false, error: 'Isi permintaan harus berupa JSON yang valid.' },
        400
      );
    }

    const validation = validateContactPayload(body);
    if (!validation.ok) {
      return jsonResponse(
        { ok: false, error: validation.error, errors: validation.errors },
        400
      );
    }

    const db = createSupabaseClient({ env, fetchImpl });
    if (!db.configured) {
      return jsonResponse(
        { ok: false, error: 'Layanan database kontak belum dikonfigurasi pada server.' },
        503
      );
    }

    const ipHash = hashIpAddress(extractClientIp(request), env.CONTACT_RATE_SALT || 'faza-portfolio-v1');

    try {
      const saved = await db.rpc('submit_contact_message', {
        p_name: validation.data.name,
        p_email: validation.data.email,
        p_message: validation.data.message,
        p_ip_hash: ipHash
      });

      return jsonResponse(
        {
          ok: true,
          id: saved?.id || null,
          createdAt: saved?.created_at || new Date().toISOString(),
          message: 'Pesan berhasil dikirim dan tercatat di Supabase.'
        },
        201
      );
    } catch (error) {
      const detail = String(error?.message || '');
      if (detail.includes('RATE_LIMIT_EXCEEDED')) {
        return jsonResponse(
          {
            ok: false,
            error: 'Terlalu banyak pengiriman pesan dalam satu jam terakhir. Silakan tunggu atau hubungi WhatsApp.'
          },
          429
        );
      }
      if (detail.includes('INVALID_')) {
        return jsonResponse(
          { ok: false, error: 'Data pesan ditolak oleh validasi server.' },
          400
        );
      }

      console.error('contact_submit_failed', error?.code || detail);
      return jsonResponse(
        { ok: false, error: 'Gagal menyimpan pesan ke Supabase. Silakan coba lagi.' },
        502
      );
    }
  };
}

export async function POST(request) {
  return createContactHandler()(request);
}
