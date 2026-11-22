import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

API_DIR = str(Path(__file__).resolve().parent)
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

from _lib.cv_builder import build_cv_json, build_cv_markdown  # noqa: E402
from _lib.supabase_client import fetch_portfolio_for_cv  # noqa: E402


class handler(BaseHTTPRequestHandler):
    """Vercel Python handler exporting Faza's portfolio as Markdown or JSON."""

    def do_GET(self):
        query = parse_qs(urlsplit(self.path).query)
        fmt = (query.get("format", ["json"])[0] or "json").strip().lower()
        portfolio = fetch_portfolio_for_cv()

        if fmt in ("md", "markdown"):
            body_text = build_cv_markdown(portfolio)
            encoded = body_text.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header(
                "Content-Disposition", 'attachment; filename="faza-fauzan-adzima-cv.md"'
            )
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return

        payload = build_cv_json(portfolio)
        encoded = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header(
            "Content-Disposition", 'attachment; filename="faza-fauzan-adzima-cv.json"'
        )
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        return
