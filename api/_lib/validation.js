import { createHash } from 'node:crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Strip ASCII control characters while keeping normal whitespace.
 * @param {unknown} value
 * @param {boolean} allowNewlines
 * @returns {string}
 */
export function stripControlChars(value, allowNewlines = false) {
  if (typeof value !== 'string') {
    return '';
  }
  const pattern = allowNewlines
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;
  return value.replace(pattern, '').trim();
}

/**
 * Validate and sanitize contact form submissions.
 * @param {unknown} payload
 */
export function validateContactPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      errors: { form: 'Format data formulir harus berupa objek JSON.' },
      error: 'Format data formulir harus berupa objek JSON.'
    };
  }

  const honeypot = stripControlChars(payload.website);
  if (honeypot.length > 0) {
    return {
      ok: false,
      isSpam: true,
      errors: { form: 'Permintaan ditolak oleh filter otomatis.' },
      error: 'Permintaan ditolak oleh filter otomatis.'
    };
  }

  const name = stripControlChars(payload.name);
  const email = stripControlChars(payload.email).toLowerCase();
  const message = stripControlChars(payload.message, true);
  const errors = {};

  if (name.length < 2 || name.length > 80) {
    errors.name = 'Nama harus diisi antara 2 hingga 80 karakter.';
  }

  if (email.length < 5 || email.length > 160 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Format alamat email tidak valid.';
  }

  if (message.length < 10 || message.length > 1500) {
    errors.message = 'Pesan harus diisi antara 10 hingga 1500 karakter.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      error: Object.values(errors)[0]
    };
  }

  return {
    ok: true,
    data: { name, email, message }
  };
}

/**
 * Derive a one-way IP hash so rate limiting avoids storing raw visitor IPs.
 * @param {string} ip
 * @param {string} salt
 * @returns {string}
 */
export function hashIpAddress(ip, salt = process.env.CONTACT_RATE_SALT || 'faza-portfolio-v1') {
  const normalized = stripControlChars(ip) || 'unknown';
  return createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

/**
 * Extract the leftmost client IP from proxy headers.
 * @param {Request} request
 * @returns {string}
 */
export function extractClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Build a JSON response with consistent cache and content headers.
 * @param {unknown} data
 * @param {number} status
 * @param {Record<string, string>} extraHeaders
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}
