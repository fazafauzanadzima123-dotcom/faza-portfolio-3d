import json
import sys
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request, urlopen

ROOT_DIR = Path(__file__).resolve().parents[2]
API_DIR = ROOT_DIR / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from _lib.security_inspector import (  # noqa: E402
    assert_public_host,
    evaluate_security_headers,
    normalize_and_validate_domain,
)
from _lib.cv_builder import build_cv_json, build_cv_markdown  # noqa: E402
import export_cv  # noqa: E402
import security_check  # noqa: E402


class DomainValidationTests(unittest.TestCase):
    def test_accepts_clean_domain_and_https_url(self):
        self.assertEqual(normalize_and_validate_domain("remover.id"), "remover.id")
        self.assertEqual(
            normalize_and_validate_domain("https://AureonMind.vercel.app/belajar?id=1"),
            "aureonmind.vercel.app",
        )

    def test_rejects_unsafe_or_malformed_inputs(self):
        invalid_cases = [
            "",
            "http://remover.id",
            "file:///etc/passwd",
            "bad domain.com",
            "remover.id:8443",
            "user@remover.id",
            "localhost",
            "127.0.0.1",
            "singlelabel",
        ]
        for raw in invalid_cases:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    normalize_and_validate_domain(raw)


class AntiSsrfTests(unittest.TestCase):
    def test_blocks_private_loopback_and_metadata_ips(self):
        blocked_ips = [
            "127.0.0.1",
            "10.0.0.5",
            "172.16.0.1",
            "192.168.1.10",
            "169.254.169.254",
            "0.0.0.0",
            "::1",
            "fc00::1",
            "fe80::1",
        ]
        for ip in blocked_ips:
            with self.subTest(ip=ip):
                fake_addr = [(2, 1, 6, "", (ip, 443))]
                with patch("_lib.security_inspector.socket.getaddrinfo", return_value=fake_addr):
                    with self.assertRaises(ValueError):
                        assert_public_host("blocked.example.com")

    def test_allows_public_ip(self):
        fake_addr = [(2, 1, 6, "", ("76.76.21.21", 443))]
        with patch("_lib.security_inspector.socket.getaddrinfo", return_value=fake_addr):
            resolved = assert_public_host("remover.id")
        self.assertEqual(resolved, ["76.76.21.21"])


class HeaderEvaluationTests(unittest.TestCase):
    def test_scores_all_six_headers_perfectly_and_has_no_em_dashes(self):
        headers = {
            "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
            "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=()",
        }
        report = evaluate_security_headers("faza.example.id", 200, headers)
        self.assertEqual(report["score"], 100)
        self.assertEqual(report["grade"], "A")
        self.assertEqual(report["presentCount"], 6)
        self.assertEqual(report["totalChecks"], 6)
        self.assertNotIn("\u2014", json.dumps(report, ensure_ascii=False))

    def test_handles_missing_headers_and_csp_frame_ancestors_fallback(self):
        headers = {
            "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
        }
        report = evaluate_security_headers("partial.example.id", 200, headers)
        self.assertEqual(report["score"], 55)
        self.assertEqual(report["grade"], "D")
        self.assertEqual(report["presentCount"], 3)


class CvBuilderTests(unittest.TestCase):
    def test_cv_contains_factual_data_and_no_em_dashes(self):
        portfolio = {
            "source": "supabase",
            "projects": [
                {
                    "name": "Remover.id",
                    "domain": "remover.id",
                    "url": "https://remover.id/",
                    "summary": "Aplikasi web unduhan media tanpa watermark.",
                    "role_label": "Developer",
                    "stack": ["Next.js", "Python"],
                },
                {
                    "name": "AureonMind",
                    "domain": "aureonmind.vercel.app",
                    "url": "https://aureonmind.vercel.app/",
                    "summary": "Tutor papan tulis AI untuk siswa SMP dan SMA.",
                    "role_label": "Developer",
                    "stack": ["Next.js", "Vercel"],
                },
            ],
            "achievements": [
                {
                    "rank_label": "Juara 7",
                    "title": "Lomba B-Brave 2026",
                    "category": "Kategori Sosial",
                    "year": 2026,
                },
                {
                    "rank_label": "Juara Harapan 3",
                    "title": "Lomba Bahasa Arab",
                    "category": "Tingkat Kabupaten",
                    "year": None,
                },
            ],
        }
        cv_json = build_cv_json(portfolio)
        self.assertEqual(cv_json["profile"]["name"], "Faza Fauzan Adzima")
        self.assertEqual(cv_json["profile"]["whatsapp"], "0882-0002-20587")
        self.assertEqual(len(cv_json["projects"]), 2)
        self.assertEqual(len(cv_json["achievements"]), 2)

        cv_md = build_cv_markdown(portfolio)
        self.assertIn("Faza Fauzan Adzima", cv_md)
        self.assertIn("Remover.id", cv_md)
        self.assertIn("AureonMind", cv_md)
        self.assertIn("Juara 7", cv_md)
        self.assertIn("Juara Harapan 3", cv_md)
        self.assertNotIn("\u2014", cv_md)


class HttpHandlerIntegrationTests(unittest.TestCase):
    def _serve_once(self, handler_cls, method, path, body=None):
        server = HTTPServer(("127.0.0.1", 0), handler_cls)
        port = server.server_address[1]
        thread = threading.Thread(target=server.handle_request, daemon=True)
        thread.start()
        try:
            headers = {}
            data = None
            if body is not None:
                data = json.dumps(body).encode("utf-8")
                headers["Content-Type"] = "application/json"
            req = Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers, method=method)
            try:
                with urlopen(req, timeout=5) as resp:
                    return resp.status, dict(resp.headers), resp.read().decode("utf-8")
            except Exception as exc:
                if hasattr(exc, "code"):
                    return exc.code, dict(exc.headers), exc.read().decode("utf-8")
                raise
        finally:
            thread.join(timeout=3)
            server.server_close()

    def test_security_check_post_and_get(self):
        mock_report = {
            "ok": True,
            "domain": "remover.id",
            "finalUrl": "https://remover.id/",
            "statusCode": 200,
            "score": 85,
            "grade": "B",
            "presentCount": 5,
            "totalChecks": 6,
            "headers": [],
        }
        with patch.object(security_check, "inspect_domain_headers", return_value=mock_report), patch.object(
            security_check, "record_scan", return_value={"id": "scan-1", "scanned_at": "2026-11-22T10:00:00Z"}
        ):
            status, _, raw = self._serve_once(
                security_check.handler, "POST", "/api/security_check", {"domain": "remover.id"}
            )
        self.assertEqual(status, 200)
        parsed = json.loads(raw)
        self.assertEqual(parsed["domain"], "remover.id")
        self.assertEqual(parsed["savedToSupabase"], True)

        with patch.object(security_check, "fetch_recent_scans", return_value=([{"domain": "remover.id"}], "supabase")):
            status_get, _, raw_get = self._serve_once(
                security_check.handler, "GET", "/api/security_check"
            )
        self.assertEqual(status_get, 200)
        self.assertEqual(json.loads(raw_get)["source"], "supabase")

    def test_export_cv_markdown_and_json(self):
        fake_portfolio = {
            "source": "supabase",
            "projects": [],
            "achievements": [],
        }
        with patch.object(export_cv, "fetch_portfolio_for_cv", return_value=fake_portfolio):
            status_md, headers_md, raw_md = self._serve_once(
                export_cv.handler, "GET", "/api/export_cv?format=md"
            )
            status_json, headers_json, raw_json = self._serve_once(
                export_cv.handler, "GET", "/api/export_cv?format=json"
            )
        self.assertEqual(status_md, 200)
        self.assertIn("text/markdown", headers_md.get("Content-Type", ""))
        self.assertIn("Faza Fauzan Adzima", raw_md)

        self.assertEqual(status_json, 200)
        self.assertIn("application/json", headers_json.get("Content-Type", ""))
        self.assertEqual(json.loads(raw_json)["profile"]["name"], "Faza Fauzan Adzima")


if __name__ == "__main__":
    unittest.main()
