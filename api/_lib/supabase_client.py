import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

FALLBACK_PROJECTS = [
    {
        "slug": "remover-id",
        "name": "Remover.id",
        "domain": "remover.id",
        "url": "https://remover.id/",
        "summary": "Aplikasi web untuk menyimpan media TikTok, Instagram, YouTube, Facebook, X, dan Pinterest tanpa watermark menggunakan alur stream langsung tanpa menyimpan berkas pengguna.",
        "role_label": "Developer",
        "stack": ["Next.js", "Python", "Supabase", "Vercel"],
    },
    {
        "slug": "aureonmind",
        "name": "AureonMind",
        "domain": "aureonmind.vercel.app",
        "url": "https://aureonmind.vercel.app/",
        "summary": "Tutor papan tulis interaktif berbasis AI yang membantu siswa SMP dan SMA di Indonesia memahami konsep pelajaran secara visual.",
        "role_label": "Developer",
        "stack": ["Next.js", "Vercel"],
    },
]

FALLBACK_ACHIEVEMENTS = [
    {
        "slug": "b-brave-2026",
        "rank_label": "Juara 7",
        "title": "Lomba B-Brave 2026",
        "category": "Kategori Sosial",
        "year": 2026,
    },
    {
        "slug": "bahasa-arab-kabupaten",
        "rank_label": "Juara Harapan 3",
        "title": "Lomba Bahasa Arab",
        "category": "Tingkat Kabupaten",
        "year": None,
    },
]


def get_supabase_credentials() -> tuple[str, str]:
    """Return trimmed Supabase URL and publishable/anon key."""
    url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or ""
    ).strip()
    return url, key


def _supabase_request(
    path: str, method: str = "GET", payload: dict[str, Any] | None = None, timeout: float = 6.0
) -> Any:
    url, key = get_supabase_credentials()
    if not url or not key:
        raise RuntimeError("SUPABASE_UNCONFIGURED")

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    body_bytes = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body_bytes = json.dumps(payload).encode("utf-8")

    req = Request(f"{url}/rest/v1/{path}", data=body_bytes, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def fetch_recent_scans(limit: int = 8) -> tuple[list[dict[str, Any]], str]:
    """Fetch recent sanitized scan summaries from Supabase."""
    safe_limit = max(1, min(int(limit), 20))
    url, key = get_supabase_credentials()
    if not url or not key:
        return [], "unavailable"

    try:
        rows = _supabase_request(
            f"security_scans?select=id,domain,score,grade,present_count,total_checks,status_code,scanned_at&order=scanned_at.desc&limit={safe_limit}"
        )
        return (rows if isinstance(rows, list) else []), "supabase"
    except (HTTPError, URLError, RuntimeError, ValueError):
        return [], "error"


def record_scan(
    domain: str,
    score: int,
    grade: str,
    present_count: int,
    total_checks: int = 6,
    status_code: int | None = None,
) -> dict[str, Any] | None:
    """Persist sanitized audit metadata via Supabase RPC when configured."""
    url, key = get_supabase_credentials()
    if not url or not key:
        return None

    try:
        result = _supabase_request(
            "rpc/record_security_scan",
            method="POST",
            payload={
                "p_domain": domain,
                "p_score": int(score),
                "p_grade": grade,
                "p_present_count": int(present_count),
                "p_total_checks": int(total_checks),
                "p_status_code": int(status_code) if status_code is not None else None,
            },
        )
        return result if isinstance(result, dict) else None
    except (HTTPError, URLError, RuntimeError, ValueError):
        return None


def fetch_portfolio_for_cv() -> dict[str, Any]:
    """Load portfolio records from Supabase with honest fallback metadata."""
    url, key = get_supabase_credentials()
    if not url or not key:
        return {
            "source": "fallback_unconfigured",
            "projects": FALLBACK_PROJECTS,
            "achievements": FALLBACK_ACHIEVEMENTS,
        }

    try:
        projects = _supabase_request(
            "projects?select=slug,name,domain,url,summary,role_label,stack&is_published=eq.true&order=sort_order.asc"
        )
        achievements = _supabase_request(
            "achievements?select=slug,rank_label,title,category,year&is_published=eq.true&order=sort_order.asc"
        )
        return {
            "source": "supabase",
            "projects": projects if isinstance(projects, list) else [],
            "achievements": achievements if isinstance(achievements, list) else [],
        }
    except (HTTPError, URLError, RuntimeError, ValueError):
        return {
            "source": "fallback_error",
            "projects": FALLBACK_PROJECTS,
            "achievements": FALLBACK_ACHIEVEMENTS,
        }
