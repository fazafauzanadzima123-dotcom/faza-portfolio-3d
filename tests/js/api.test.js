import test from 'node:test';
import assert from 'node:assert/strict';

import { validateContactPayload, hashIpAddress } from '../../api/_lib/validation.js';
import { createHealthHandler } from '../../api/health.js';
import { createPortfolioHandler } from '../../api/portfolio.js';
import { createContactHandler } from '../../api/contact.js';

function makeRequest(url, options = {}) {
  return new Request(url, options);
}

test('validateContactPayload rejects short name, invalid email, short message, and honeypot spam', () => {
  const shortName = validateContactPayload({
    name: 'A',
    email: 'faza@example.com',
    message: 'Halo Faza, saya ingin berdiskusi soal proyek web.'
  });
  assert.equal(shortName.ok, false);
  assert.ok(shortName.errors.name);

  const badEmail = validateContactPayload({
    name: 'Budi Santoso',
    email: 'budi-tidak-valid',
    message: 'Halo Faza, saya ingin berdiskusi soal proyek web.'
  });
  assert.equal(badEmail.ok, false);
  assert.ok(badEmail.errors.email);

  const shortMessage = validateContactPayload({
    name: 'Budi Santoso',
    email: 'budi@example.com',
    message: 'Pendek'
  });
  assert.equal(shortMessage.ok, false);
  assert.ok(shortMessage.errors.message);

  const botPayload = validateContactPayload({
    name: 'Bot',
    email: 'bot@example.com',
    message: 'Ini adalah pesan spam otomatis dari bot.',
    website: 'https://spam.example'
  });
  assert.equal(botPayload.ok, false);
  assert.equal(botPayload.isSpam, true);
});

test('validateContactPayload trims clean Indonesian input and strips control characters', () => {
  const result = validateContactPayload({
    name: '  Siti\u0007 Rahmawati  ',
    email: '  Siti@Example.ID ',
    message: '  Halo Faza, saya tertarik berkolaborasi pada audit keamanan web sekolah.  ',
    website: ''
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.name, 'Siti Rahmawati');
  assert.equal(result.data.email, 'siti@example.id');
  assert.equal(
    result.data.message,
    'Halo Faza, saya tertarik berkolaborasi pada audit keamanan web sekolah.'
  );
});

test('hashIpAddress produces deterministic non-reversible SHA-256 hex digest', () => {
  const first = hashIpAddress('203.0.113.10', 'test-salt');
  const second = hashIpAddress('203.0.113.10', 'test-salt');
  const third = hashIpAddress('203.0.113.11', 'test-salt');

  assert.equal(first.length, 64);
  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.ok(!first.includes('203.0.113.10'));
});

test('GET /api/health reports runtime and Supabase configuration readiness', async () => {
  const unconfigured = createHealthHandler({ env: {} });
  const res1 = await unconfigured(makeRequest('https://example.test/api/health'));
  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.ok, true);
  assert.equal(body1.runtime, 'nodejs');
  assert.equal(body1.supabaseConfigured, false);

  const configured = createHealthHandler({
    env: {
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo'
    }
  });
  const res2 = await configured(makeRequest('https://example.test/api/health'));
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.supabaseConfigured, true);
});

test('GET /api/portfolio fetches live Supabase projects, achievements, and scans', async () => {
  const mockFetch = async (url) => {
    const target = String(url);
    if (target.includes('/rest/v1/projects')) {
      return new Response(
        JSON.stringify([
          {
            slug: 'remover-id',
            name: 'Remover.id',
            domain: 'remover.id',
            url: 'https://remover.id/',
            summary: 'Penghapus watermark media sosial.',
            role_label: 'Developer',
            stack: ['Next.js', 'Python']
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (target.includes('/rest/v1/achievements')) {
      return new Response(
        JSON.stringify([
          {
            slug: 'b-brave-2026',
            rank_label: 'Juara 7',
            title: 'Lomba B-Brave 2026',
            category: 'Kategori Sosial',
            year: 2026
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (target.includes('/rest/v1/security_scans')) {
      return new Response(
        JSON.stringify([
          {
            id: 'scan-1',
            domain: 'remover.id',
            score: 85,
            grade: 'B',
            present_count: 5,
            total_checks: 6,
            status_code: 200,
            scanned_at: '2026-11-22T09:00:00Z'
          }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('Not found', { status: 404 });
  };

  const handler = createPortfolioHandler({
    env: {
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo'
    },
    fetchImpl: mockFetch
  });

  const res = await handler(makeRequest('https://example.test/api/portfolio'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'supabase');
  assert.equal(body.projects.length, 1);
  assert.equal(body.projects[0].name, 'Remover.id');
  assert.equal(body.achievements.length, 1);
  assert.equal(body.achievements[0].rank_label, 'Juara 7');
  assert.equal(body.recentScans.length, 1);
});

test('GET /api/portfolio returns honest 503 error state when Supabase is not configured or fails', async () => {
  const unconfiguredHandler = createPortfolioHandler({ env: {} });
  const res1 = await unconfiguredHandler(makeRequest('https://example.test/api/portfolio'));
  assert.equal(res1.status, 503);
  const body1 = await res1.json();
  assert.equal(body1.ok, false);
  assert.equal(body1.source, 'unavailable');

  const failingFetch = async () => new Response('Internal error', { status: 500 });
  const failingHandler = createPortfolioHandler({
    env: {
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo'
    },
    fetchImpl: failingFetch
  });
  const res2 = await failingHandler(makeRequest('https://example.test/api/portfolio'));
  assert.equal(res2.status, 502);
  const body2 = await res2.json();
  assert.equal(body2.ok, false);
});

test('POST /api/contact validates JSON, handles rate limits, and submits via Supabase RPC', async () => {
  let capturedBody = null;
  const okFetch = async (url, init) => {
    assert.ok(String(url).includes('/rest/v1/rpc/submit_contact_message'));
    capturedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({ id: 'msg-123', created_at: '2026-11-22T10:00:00Z' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const handler = createContactHandler({
    env: {
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo',
      CONTACT_RATE_SALT: 'salt-1'
    },
    fetchImpl: okFetch
  });

  const badJsonRes = await handler(
    makeRequest('https://example.test/api/contact', {
      method: 'POST',
      body: '{invalid-json',
      headers: { 'Content-Type': 'application/json' }
    })
  );
  assert.equal(badJsonRes.status, 400);

  const okRes = await handler(
    makeRequest('https://example.test/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.4'
      },
      body: JSON.stringify({
        name: 'Andi Wijaya',
        email: 'andi@example.id',
        message: 'Halo Faza, saya ingin mengajak kerja sama pengembangan aplikasi web.'
      })
    })
  );
  assert.equal(okRes.status, 201);
  const okData = await okRes.json();
  assert.equal(okData.ok, true);
  assert.equal(okData.id, 'msg-123');
  assert.equal(capturedBody.p_name, 'Andi Wijaya');
  assert.equal(capturedBody.p_email, 'andi@example.id');
  assert.equal(capturedBody.p_ip_hash.length, 64);

  const rateLimitedFetch = async () =>
    new Response(
      JSON.stringify({ code: 'P0001', message: 'RATE_LIMIT_EXCEEDED' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  const rateLimitedHandler = createContactHandler({
    env: {
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo'
    },
    fetchImpl: rateLimitedFetch
  });
  const limitRes = await rateLimitedHandler(
    makeRequest('https://example.test/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Andi Wijaya',
        email: 'andi@example.id',
        message: 'Halo Faza, saya ingin mengajak kerja sama pengembangan aplikasi web.'
      })
    })
  );
  assert.equal(limitRes.status, 429);
});
