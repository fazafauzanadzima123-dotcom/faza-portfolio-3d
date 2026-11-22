import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

API_DIR = str(Path(__file__).resolve().parent)
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

from _lib.http_utils import read_json_body, send_json  # noqa: E402
from _lib.security_inspector import inspect_domain_headers  # noqa: E402
from _lib.supabase_client import fetch_recent_scans, record_scan  # noqa: E402


class handler(BaseHTTPRequestHandler):
    """Vercel Python handler for HTTP security header audits and scan history."""

    def do_GET(self):
        scans, source = fetch_recent_scans(limit=8)
        send_json(
            self,
            200,
            {
                "ok": True,
                "runtime": "python",
                "source": source,
                "scans": scans,
            },
        )

    def do_POST(self):
        try:
            body = read_json_body(self)
        except ValueError as err:
            send_json(self, 400, {"ok": False, "error": str(err)})
            return

        domain_input = body.get("domain", "")
        try:
            report = inspect_domain_headers(domain_input)
        except ValueError as err:
            send_json(self, 400, {"ok": False, "error": str(err)})
            return
        except Exception as err:
            print(f"security_check_unexpected_error: {err}", file=sys.stderr)
            send_json(
                self,
                502,
                {"ok": False, "error": "Pemeriksaan header gagal diproses pada server Python."},
            )
            return

        saved = record_scan(
            domain=report["domain"],
            score=report["score"],
            grade=report["grade"],
            present_count=report["presentCount"],
            total_checks=report["totalChecks"],
            status_code=report["statusCode"],
        )
        report["savedToSupabase"] = saved is not None
        if saved:
            report["scanId"] = saved.get("id")
            report["scannedAt"] = saved.get("scanned_at")

        send_json(self, 200, report)

    def log_message(self, format, *args):
        return
