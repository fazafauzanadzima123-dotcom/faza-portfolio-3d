import json
from http.server import BaseHTTPRequestHandler


def send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    """Serialize payload as UTF-8 JSON with no-store caching."""
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def read_json_body(handler: BaseHTTPRequestHandler, max_bytes: int = 8192) -> dict:
    """Read and parse a bounded JSON request body."""
    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as exc:
        raise ValueError("Header Content-Length tidak valid.") from exc

    if content_length <= 0:
        raise ValueError("Isi permintaan JSON tidak boleh kosong.")
    if content_length > max_bytes:
        raise ValueError("Ukuran permintaan melebihi batas yang diizinkan.")

    raw_bytes = handler.rfile.read(content_length)
    try:
        parsed = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Format JSON tidak valid.") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Payload JSON harus berupa objek.")
    return parsed
