import ipaddress
import re
import socket
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DOMAIN_PATTERN = re.compile(
    r"^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)

HEADER_SPECS = [
    {
        "key": "strict-transport-security",
        "label": "Strict-Transport-Security (HSTS)",
        "weight": 20,
        "recommendation": "Tambahkan header HSTS minimal max-age=31536000 agar browser selalu memaksa koneksi HTTPS.",
    },
    {
        "key": "content-security-policy",
        "label": "Content-Security-Policy (CSP)",
        "weight": 25,
        "recommendation": "Tetapkan aturan CSP untuk membatasi asal skrip, gaya, dan koneksi guna menekan risiko XSS.",
    },
    {
        "key": "x-content-type-options",
        "label": "X-Content-Type-Options",
        "weight": 15,
        "recommendation": "Setel nilai nosniff agar browser tidak menebak tipe MIME secara sembarangan.",
    },
    {
        "key": "x-frame-options",
        "label": "Proteksi Clickjacking (X-Frame-Options / frame-ancestors)",
        "weight": 15,
        "recommendation": "Gunakan X-Frame-Options: DENY atau directive CSP frame-ancestors 'none'.",
    },
    {
        "key": "referrer-policy",
        "label": "Referrer-Policy",
        "weight": 15,
        "recommendation": "Gunakan strict-origin-when-cross-origin untuk melindungi parameter URL lintas situs.",
    },
    {
        "key": "permissions-policy",
        "label": "Permissions-Policy",
        "weight": 10,
        "recommendation": "Batasi fitur sensitif seperti camera=(), microphone=(), dan geolocation=() bila tidak dipakai.",
    },
]


def normalize_and_validate_domain(raw_value: str) -> str:
    """Normalize domain or HTTPS URL and reject unsafe protocols, ports, or IP literals."""
    if not isinstance(raw_value, str):
        raise ValueError("Input domain harus berupa teks.")

    cleaned = raw_value.strip()
    if not cleaned:
        raise ValueError("Masukkan nama domain publik, misalnya remover.id.")

    lower_cleaned = cleaned.lower()
    if lower_cleaned.startswith("http://"):
        raise ValueError("Hanya domain publik HTTPS yang diizinkan untuk inspeksi.")
    if "://" in cleaned and not lower_cleaned.startswith("https://"):
        raise ValueError("Skema URL tidak didukung. Gunakan domain publik HTTPS.")

    target_url = cleaned if lower_cleaned.startswith("https://") else f"https://{cleaned}"
    parsed = urlsplit(target_url)

    if parsed.username or parsed.password or "@" in parsed.netloc:
        raise ValueError("Format domain tidak boleh menyertakan kredensial.")
    if ":" in parsed.netloc:
        raise ValueError("Port khusus tidak diizinkan dalam audit domain publik.")

    hostname = (parsed.hostname or "").strip(".").lower()
    if not hostname or hostname == "localhost":
        raise ValueError("Hostname lokal tidak diizinkan.")

    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ValueError("Masukkan nama domain publik, bukan alamat IP langsung.")

    if not DOMAIN_PATTERN.match(hostname):
        raise ValueError("Format domain tidak valid. Contoh yang benar: remover.id.")

    return hostname


def _is_disallowed_ip(ip_text: str) -> bool:
    ip_obj = ipaddress.ip_address(ip_text.split("%")[0])
    if (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    ):
        return True

    mapped = getattr(ip_obj, "ipv4_mapped", None)
    if mapped is not None and _is_disallowed_ip(str(mapped)):
        return True

    return False


def assert_public_host(hostname: str) -> list[str]:
    """Resolve DNS and reject private, loopback, link-local, or metadata targets (anti-SSRF)."""
    try:
        records = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Domain {hostname} tidak dapat di-resolve melalui DNS.") from exc

    resolved_ips: list[str] = []
    for entry in records:
        sockaddr = entry[4]
        ip_text = sockaddr[0]
        if _is_disallowed_ip(ip_text):
            raise ValueError("Target mengarah ke jaringan internal atau IP terlarang dan diblokir.")
        if ip_text not in resolved_ips:
            resolved_ips.append(ip_text)

    if not resolved_ips:
        raise ValueError(f"Tidak ada alamat publik yang ditemukan untuk {hostname}.")

    return resolved_ips


class _SafeHttpsRedirectHandler(HTTPRedirectHandler):
    """Re-validate every redirect hop against HTTPS-only and anti-SSRF rules."""

    def __init__(self) -> None:
        self.redirects_seen = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.redirects_seen += 1
        if self.redirects_seen > 3:
            raise ValueError("Terlalu banyak pengalihan HTTP (maksimal 3 kali).")

        parsed = urlsplit(newurl)
        if parsed.scheme.lower() != "https":
            raise ValueError("Pengalihan ke protokol non-HTTPS diblokir.")

        next_host = normalize_and_validate_domain(newurl)
        assert_public_host(next_host)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _compute_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def evaluate_security_headers(
    domain: str, status_code: int, raw_headers: dict[str, str], final_url: str | None = None
) -> dict[str, Any]:
    """Score 6 standard HTTP security headers and return Indonesian recommendations."""
    normalized_headers = {str(k).lower(): str(v).strip() for k, v in raw_headers.items()}
    csp_value = normalized_headers.get("content-security-policy", "")

    checks: list[dict[str, Any]] = []
    total_score = 0
    present_count = 0

    for spec in HEADER_SPECS:
        key = spec["key"]
        raw_val = normalized_headers.get(key, "")
        present = False

        if key == "strict-transport-security":
            present = bool(raw_val) and "max-age=" in raw_val.lower() and "max-age=0" not in raw_val.lower()
        elif key == "x-content-type-options":
            present = "nosniff" in raw_val.lower()
        elif key == "x-frame-options":
            has_xfo = bool(raw_val)
            has_csp_ancestors = "frame-ancestors" in csp_value.lower()
            present = has_xfo or has_csp_ancestors
            if not raw_val and has_csp_ancestors:
                raw_val = "(Diatur lewat CSP frame-ancestors)"
        else:
            present = bool(raw_val)

        earned = spec["weight"] if present else 0
        if present:
            total_score += earned
            present_count += 1

        display_value = raw_val[:180] + ("..." if len(raw_val) > 180 else "") if raw_val else ""

        checks.append(
            {
                "key": key,
                "label": spec["label"],
                "present": present,
                "statusLabel": "Ada" if present else "Hilang",
                "weight": spec["weight"],
                "earned": earned,
                "value": display_value,
                "recommendation": "" if present else spec["recommendation"],
            }
        )

    return {
        "ok": True,
        "domain": domain,
        "finalUrl": final_url or f"https://{domain}/",
        "statusCode": status_code,
        "score": total_score,
        "grade": _compute_grade(total_score),
        "presentCount": present_count,
        "totalChecks": len(HEADER_SPECS),
        "headers": checks,
    }


def inspect_domain_headers(raw_domain: str, timeout: float = 6.0) -> dict[str, Any]:
    """Fetch HTTPS headers from a verified public domain and score security posture."""
    domain = normalize_and_validate_domain(raw_domain)
    assert_public_host(domain)

    target_url = f"https://{domain}/"
    req = Request(
        target_url,
        method="GET",
        headers={
            "User-Agent": "FazaSecurityLab/1.0 (+https://github.com/fazafauzanadzima123-dotcom)",
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        },
    )
    opener = build_opener(_SafeHttpsRedirectHandler())

    try:
        with opener.open(req, timeout=timeout) as response:
            status_code = response.getcode() or 200
            final_url = response.geturl() or target_url
            header_map = dict(response.headers.items())
            return evaluate_security_headers(domain, status_code, header_map, final_url=final_url)
    except HTTPError as http_err:
        header_map = dict(http_err.headers.items()) if http_err.headers else {}
        final_url = http_err.geturl() if hasattr(http_err, "geturl") else target_url
        return evaluate_security_headers(domain, http_err.code, header_map, final_url=final_url)
    except URLError as url_err:
        reason = str(url_err.reason)
        raise ValueError(f"Koneksi HTTPS ke {domain} gagal: {reason}") from url_err
    except TimeoutError as exc:
        raise ValueError(f"Waktu koneksi ke {domain} habis setelah {int(timeout)} detik.") from exc
