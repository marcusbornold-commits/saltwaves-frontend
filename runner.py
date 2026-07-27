#!/usr/bin/env python3
"""
PodMaster local run panel — lokal driftpanel för kedjekörning.

Kör på Mac Mini:
    cd ~/PodMaster && python3 runner.py

Öppna från MacBook via SSH-forward:
    ssh -L 8766:127.0.0.1:8766 mac-mini
    → http://localhost:3000/tools/local-run  (frontend på MacBook)

SÄKERHET: binder ENDAST till 127.0.0.1.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 8766

HOME = Path.home()
PANEL_DIR = HOME / "Saltwaves" / "Panel"
SPECS_PATH = PANEL_DIR / "specs.json"
PODMASTER_ROOT = HOME / "PodMaster"
PODMASTER_PYTHON = HOME / "podmaster-env" / "bin" / "python"
OUTPUT_DIR = PODMASTER_ROOT / "output"
CHAIN_OUTPUT = OUTPUT_DIR / "before_mastered.wav"

DEFAULT_SPECS = {
    "podcast": {
        "label": "Podcast",
        "lufs": -16,
        "dbtp": -1,
        "brusgolv": -50,
    },
    "audiobook_nordic": {
        "label": "Audiobook Nordic",
        "lufs": -18,
        "dbtp": -3,
        "brusgolv": -60,
    },
    "audiobook_acx": {
        "label": "Audiobook ACX",
        "lufs": -20,
        "dbtp": -3,
        "brusgolv": -60,
    },
    "broadcast": {
        "label": "Broadcast",
        "lufs": -23,
        "dbtp": -1,
        "brusgolv": -55,
    },
}

VALID_MODES = {"mild", "standard", "strong"}
VALID_MICS = {"dynamic", "condenser", "headset", "unknown"}
SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aiff"}

_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def ensure_specs() -> dict:
    PANEL_DIR.mkdir(parents=True, exist_ok=True)
    if not SPECS_PATH.exists():
        SPECS_PATH.write_text(json.dumps(DEFAULT_SPECS, indent=2) + "\n", encoding="utf-8")
        return dict(DEFAULT_SPECS)
    try:
        data = json.loads(SPECS_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return dict(DEFAULT_SPECS)


def cors_headers() -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Filename",
    }


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    for key, value in cors_headers().items():
        handler.send_header(key, value)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def file_response(
    handler: BaseHTTPRequestHandler,
    path: Path,
    content_type: str,
    *,
    attachment_name: str | None = None,
) -> None:
    if not path.is_file():
        json_response(handler, 404, {"error": "file not found"})
        return
    data = path.read_bytes()
    handler.send_response(200)
    for key, value in cors_headers().items():
        handler.send_header(key, value)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(data)))
    if attachment_name:
        handler.send_header(
            "Content-Disposition",
            f'attachment; filename="{attachment_name}"',
        )
    handler.end_headers()
    handler.wfile.write(data)


def content_type_for(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".aiff": "audio/aiff",
    }.get(ext, "application/octet-stream")


def safe_filename(name: str) -> str:
    base = Path(name).name
    if not base or base in {".", ".."}:
        return "upload.wav"
    return base


def set_job(job_id: str, **patch) -> None:
    with _jobs_lock:
        job = _jobs.setdefault(job_id, {})
        job.update(patch)


def get_job(job_id: str) -> dict | None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def run_chain(job_id: str, input_path: Path, mode: str, mic: str) -> None:
    log_lines: list[str] = []
    set_job(job_id, status="running", log="Startar kedjan…")

    if not PODMASTER_PYTHON.is_file():
        msg = f"Python hittades inte: {PODMASTER_PYTHON}"
        set_job(job_id, status="error", log=msg)
        return

    cmd = [
        str(PODMASTER_PYTHON),
        "-m",
        "app.main",
        str(input_path),
        mode,
        mic,
        "false",
    ]
    log_lines.append(f"$ {' '.join(cmd)}")
    log_lines.append(f"cwd: {PODMASTER_ROOT}")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(PODMASTER_ROOT),
            capture_output=True,
            text=True,
        )
        if result.stdout:
            log_lines.append(result.stdout.rstrip())
        if result.stderr:
            log_lines.append(result.stderr.rstrip())

        if result.returncode != 0:
            set_job(
                job_id,
                status="error",
                log="\n".join(log_lines) + f"\n\nExit code: {result.returncode}",
            )
            return

        if not CHAIN_OUTPUT.is_file():
            set_job(
                job_id,
                status="error",
                log="\n".join(log_lines)
                + f"\n\nOutput saknas: {CHAIN_OUTPUT}",
            )
            return

        job_dir = PANEL_DIR / job_id
        after_path = job_dir / "after.wav"
        shutil.move(str(CHAIN_OUTPUT), str(after_path))
        log_lines.append(f"Flyttade output → {after_path}")

        set_job(job_id, status="done", log="\n".join(log_lines))
    except Exception as exc:
        set_job(
            job_id,
            status="error",
            log="\n".join(log_lines) + f"\n\nFel: {exc}",
        )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        for key, value in cors_headers().items():
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/specs":
            json_response(self, 200, ensure_specs())
            return

        if path.startswith("/job/"):
            job_id = path.split("/", 2)[2]
            job = get_job(job_id)
            if not job:
                json_response(self, 404, {"error": "job not found"})
                return
            json_response(
                self,
                200,
                {"status": job.get("status", "running"), "log": job.get("log", "")},
            )
            return

        if path.startswith("/audio/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                _, job_id, which = parts
                job_dir = PANEL_DIR / job_id
                if which == "before":
                    matches = sorted(job_dir.glob("before.*"))
                    if matches:
                        file_response(self, matches[0], content_type_for(matches[0]))
                        return
                elif which == "after":
                    after = job_dir / "after.wav"
                    if after.is_file():
                        file_response(self, after, "audio/wav")
                        return
            json_response(self, 404, {"error": "audio not found"})
            return

        if path.startswith("/download/"):
            job_id = path.split("/", 2)[2]
            job = get_job(job_id)
            after = PANEL_DIR / job_id / "after.wav"
            if not job or not after.is_file():
                json_response(self, 404, {"error": "download not found"})
                return
            original = job.get("original_name", "master")
            stem = Path(original).stem
            ext = after.suffix
            file_response(
                self,
                after,
                "audio/wav",
                attachment_name=f"{stem}_mastered{ext}",
            )
            return

        json_response(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/run":
            json_response(self, 404, {"error": "not found"})
            return

        params = parse_qs(parsed.query)
        spec = params.get("spec", [""])[0]
        mic = params.get("mic", ["unknown"])[0]
        mode = params.get("mode", ["standard"])[0]
        filename = params.get("filename", ["upload.wav"])[0]

        if spec not in ensure_specs():
            json_response(self, 400, {"error": f"unknown spec: {spec}"})
            return
        if mode not in VALID_MODES:
            json_response(self, 400, {"error": f"invalid mode: {mode}"})
            return
        if mic not in VALID_MICS:
            json_response(self, 400, {"error": f"invalid mic: {mic}"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length > 0 else b""
        if not body:
            json_response(self, 400, {"error": "empty body"})
            return

        safe_name = safe_filename(filename)
        ext = Path(safe_name).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            json_response(self, 400, {"error": f"unsupported extension: {ext}"})
            return

        job_id = uuid.uuid4().hex[:12]
        job_dir = PANEL_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        before_path = job_dir / f"before{ext}"
        before_path.write_bytes(body)

        set_job(
            job_id,
            status="running",
            log="",
            spec=spec,
            mic=mic,
            mode=mode,
            original_name=safe_name,
            before_ext=ext,
        )

        thread = threading.Thread(
            target=run_chain,
            args=(job_id, before_path, mode, mic),
            daemon=True,
        )
        thread.start()

        json_response(self, 200, {"id": job_id})


def main() -> None:
    ensure_specs()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Local run panel on http://{HOST}:{PORT}")
    print(f"Panel jobs: {PANEL_DIR}")
    print(f"Chain output expected at: {CHAIN_OUTPUT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
