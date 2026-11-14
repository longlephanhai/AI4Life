"""
gemini_client.py
----------------
Client gọn nhẹ gọi Google Gemini REST API (không cần cài thêm thư viện ngoài),
hỗ trợ đọc `GEMINI_API_KEY` từ biến môi trường hoặc file `.env` và ép trả JSON
theo `responseSchema` (Structured Output).
"""

import json
import logging
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("gemini_client")

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_CANDIDATES = [
    Path(__file__).resolve().parent / ".env",
    BASE_DIR / ".env",
]
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
FALLBACK_GEMINI_MODELS = (
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
)
RETRYABLE_HTTP_CODES = {404, 429, 500, 502, 503, 504}
PLACEHOLDER_KEYS = {"", "your_gemini_api_key_here", "paste_your_key_here"}


def _read_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values
    try:
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k:
                values[k] = v
    except Exception as exc:
        logger.warning("Không đọc được file env %s: %s", path, exc)
    return values


def get_config() -> Dict[str, str]:
    """Lấy cấu hình Gemini hiện tại (ưu tiên os.environ, fallback sang backend/.env hoặc .env)."""
    merged: Dict[str, str] = {}
    for env_path in reversed(ENV_CANDIDATES):
        merged.update(_read_env_file(env_path))

    api_key = os.environ.get("GEMINI_API_KEY") or merged.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_MODEL") or merged.get("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL
    if api_key.strip() in PLACEHOLDER_KEYS:
        api_key = ""
    return {
        "api_key": api_key.strip(),
        "model": model.strip() or DEFAULT_GEMINI_MODEL,
    }


def is_configured() -> bool:
    return bool(get_config()["api_key"])


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    return {
        "provider": "gemini",
        "configured": bool(cfg["api_key"]),
        "model": cfg["model"],
        "env_file_hint": str(ENV_CANDIDATES[0]),
    }


def generate_json(
    system_prompt: str,
    user_prompt: str,
    response_schema: Dict[str, Any],
    temperature: float = 0.1,
    timeout: float = 8.0,
) -> Optional[Dict[str, Any]]:
    """
    Gọi Gemini `generateContent` với JSON Mode + `responseSchema`.
    Trả về dict JSON hợp lệ hoặc `None` nếu chưa có key / lỗi mạng (để fallback offline an toàn).
    """
    cfg = get_config()
    api_key = cfg["api_key"]
    if not api_key:
        return None

    models_to_try = [cfg["model"]]
    for fb in FALLBACK_GEMINI_MODELS:
        if fb not in models_to_try:
            models_to_try.append(fb)

    payload = {
        "systemInstruction": {
            "parts": [{"text": system_prompt}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }
    data_bytes = json.dumps(payload).encode("utf-8")

    for model_name in models_to_try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_name}:generateContent?key={api_key}"
        )
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            candidates = body.get("candidates") or []
            if not candidates:
                logger.warning("Gemini không trả về candidate nào: %s", body)
                return None
            parts = (candidates[0].get("content") or {}).get("parts") or []
            raw_text = "".join(p.get("text", "") for p in parts).strip()
            if not raw_text:
                return None
            return json.loads(raw_text)
        except urllib.error.HTTPError as exc:
            err_detail = exc.read().decode("utf-8", errors="ignore")[:300]
            logger.warning("Gemini HTTP %s (%s): %s", exc.code, model_name, err_detail)
            if exc.code in RETRYABLE_HTTP_CODES and model_name != models_to_try[-1]:
                continue
            return None
        except (TimeoutError, urllib.error.URLError) as exc:
            logger.warning("Gemini timeout/network (%s): %s", model_name, exc)
            if model_name != models_to_try[-1]:
                continue
            return None
        except Exception as exc:
            logger.warning("Lỗi gọi Gemini API (%s), tự động lùi về offline fallback.", exc)
            return None
    return None

