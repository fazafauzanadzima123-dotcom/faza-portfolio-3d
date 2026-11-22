import { createSupabaseClient } from './_lib/supabase.js';
import { jsonResponse } from './_lib/validation.js';

/**
 * Build a testable GET /api/portfolio handler backed by Supabase PostgREST.
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} deps
 */
export function createPortfolioHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async function handlePortfolio() {
    const db = createSupabaseClient({ env, fetchImpl });

    if (!db.configured) {
      return jsonResponse(
        {
          ok: false,
          source: 'unavailable',
          error: 'Koneksi Supabase belum dikonfigurasi pada server.'
        },
        503
      );
    }

    try {
      const [projects, achievements, recentScans] = await Promise.all([
        db.selectRows(
          'projects',
          'select=slug,name,domain,url,summary,role_label,stack,sort_order&is_published=eq.true&order=sort_order.asc'
        ),
        db.selectRows(
          'achievements',
          'select=slug,rank_label,title,category,year,sort_order&is_published=eq.true&order=sort_order.asc'
        ),
        db.selectRows(
          'security_scans',
          'select=id,domain,score,grade,present_count,total_checks,status_code,scanned_at&order=scanned_at.desc&limit=8'
        )
      ]);

      return jsonResponse({
        ok: true,
        source: 'supabase',
        projects: Array.isArray(projects) ? projects : [],
        achievements: Array.isArray(achievements) ? achievements : [],
        recentScans: Array.isArray(recentScans) ? recentScans : []
      });
    } catch (error) {
      console.error('portfolio_fetch_failed', error?.code || error?.message || error);
      return jsonResponse(
        {
          ok: false,
          source: 'error',
          error: 'Gagal mengambil data portofolio dari Supabase. Coba muat ulang beberapa saat lagi.'
        },
        502
      );
    }
  };
}

export async function GET(request) {
  return createPortfolioHandler()(request);
}
