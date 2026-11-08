#!/usr/bin/env bash
# run.sh - Khởi động SignBridge AI Backend Server

cd "$(dirname "$0")"
echo "=== Đang khởi động SignBridge AI FastAPI Server tại http://127.0.0.1:8000 ==="
echo "=== Tài liệu API Swagger UI: http://127.0.0.1:8000/docs ==="

~/.local/bin/uv run --with fastapi,uvicorn,pydantic,python-multipart uvicorn main:app --host 0.0.0.0 --port 8000 --reload

