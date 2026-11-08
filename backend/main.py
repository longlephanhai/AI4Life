"""
main.py
-------
FastAPI Server cho SignBridge AI (AI4Life)
Kết nối giữa Model nhận diện cử chỉ VSL và Giao diện người dùng (Bệnh nhân & Bác sĩ).
"""

import json
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from schemas import SemanticFrame, ParseRequest, RecognizeResponse, IntentType
from semantic_parser import parse_semantic_frame

app = FastAPI(
    title="SignBridge AI — Medical Reception API",
    description="API hỗ trợ tiếp nhận y tế ban đầu cho người câm điếc sử dụng Ngôn ngữ ký hiệu VSL",
    version="1.0.0"
)

# Cho phép Frontend (Next.js / React) gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database lưu tạm danh sách ca khám (In-memory storage cho demo)
CLINIC_QUEUE = []

# Đọc thử dataset.json để phục vụ chế độ demo các ca có sẵn
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_JSON_PATH = BASE_DIR / "AI" / "data" / "dataset.json"
DATASET_SAMPLES = {}

if DATASET_JSON_PATH.exists():
    try:
        with open(DATASET_JSON_PATH, encoding="utf-8") as f:
            data = json.load(f)
            for item in data[:50]:  # Lấy 50 mẫu đầu tiên làm kho mẫu
                sid = item.get("id")
                if sid:
                    DATASET_SAMPLES[sid] = {
                        "id": sid,
                        "gloss_sequence": item.get("gloss_sequence", []),
                        "translation": item.get("translation", ""),
                        "duration_sec": item.get("duration_sec", 0)
                    }
        print(f"[Backend] Đã nạp {len(DATASET_SAMPLES)} ca mẫu từ dataset.json")
    except Exception as e:
        print(f"[Backend] Không thể nạp dataset.json: {e}")


@app.get("/")
def root():
    return {
        "project": "SignBridge AI",
        "description": "Nền tảng hỗ trợ tiếp nhận y tế ban đầu cho người sử dụng VSL",
        "competition": "AI4Life 2026",
        "status": "online",
        "docs_url": "/docs"
    }


@app.get("/health")
def health():
    return {"status": "ok", "samples_loaded": len(DATASET_SAMPLES)}


@app.post("/api/parse", response_model=SemanticFrame)
def api_parse(req: ParseRequest):
    """
    Phân tích trực tiếp từ chuỗi Gloss hoặc Câu dịch tiếng Việt thành phiếu y tế.
    """
    if not req.gloss_sequence and not req.translation:
        raise HTTPException(status_code=400, detail="Cần cung cấp ít nhất chuỗi Gloss hoặc Câu dịch.")
    return parse_semantic_frame(
        gloss_sequence=req.gloss_sequence,
        translation=req.translation
    )


@app.post("/api/recognize", response_model=RecognizeResponse)
async def api_recognize(
    sample_id: Optional[str] = Form(None),
    video: Optional[UploadFile] = File(None)
):
    """
    API Nhận diện cử chỉ ký hiệu:
    1. Nếu chọn sample_id: Trả về kết quả mẫu chuẩn từ bộ dữ liệu.
    2. Nếu upload video: Xử lý qua pipeline nhận diện (tạm thời trả về mock trong lúc đợi train).
    """
    if sample_id and sample_id in DATASET_SAMPLES:
        sample = DATASET_SAMPLES[sample_id]
        glosses = sample["gloss_sequence"]
        translation = sample["translation"]
        confidence = 0.96
    elif video:
        # Giả lập nhận diện từ video upload cho đến khi model Colab hoàn thành
        glosses = ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"]
        translation = "Tôi muốn đăng ký khám sức khỏe."
        confidence = 0.92
    else:
        # Mặc định kịch bản đăng ký khám
        glosses = ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"]
        translation = "Tôi muốn đăng ký khám sức khỏe."
        confidence = 0.95

    # Tự động chuyển qua Semantic Parser
    frame = parse_semantic_frame(gloss_sequence=glosses, translation=translation)

    return RecognizeResponse(
        sample_id=sample_id,
        gloss_sequence=glosses,
        translation=translation,
        confidence=confidence,
        semantic_frame=frame
    )


class ConfirmRequest(BaseModel):
    ticket_id: Optional[str] = None
    patient_name: Optional[str] = "Bệnh nhân ẩn danh"
    status: str = "confirmed"  # "confirmed" (Đúng) | "edited" (Đã sửa) | "need_help" (Gọi hỗ trợ)
    confirmed_text: str
    semantic_frame: SemanticFrame


@app.post("/api/confirm")
def api_confirm(req: ConfirmRequest):
    """
    Người bệnh bấm xác nhận [ĐÚNG, GỬI ĐI] ➔ Đẩy vào hàng đợi tiếp nhận của nhân viên y tế.
    """
    ticket_num = len(CLINIC_QUEUE) + 1
    record = {
        "ticket_number": f"A{ticket_num:03d}",
        "patient_name": req.patient_name,
        "status": req.status,
        "confirmed_text": req.confirmed_text,
        "semantic_frame": req.semantic_frame.dict(),
        "created_at": "15:30"
    }
    CLINIC_QUEUE.append(record)
    return {
        "success": True,
        "ticket_number": record["ticket_number"],
        "message": f"Đã gửi thành công! Số thứ tự của bạn là {record['ticket_number']}."
    }


@app.get("/api/queue")
def api_get_queue():
    """
    Màn hình Bác sĩ / Nhân viên tiếp nhận lấy danh sách các ca bệnh nhân vừa gửi.
    """
    return {
        "total_cases": len(CLINIC_QUEUE),
        "cases": CLINIC_QUEUE
    }


@app.get("/api/sample-scenarios")
def api_get_sample_scenarios():
    """
    Danh sách 4 kịch bản chuẩn bị sẵn để Frontend đưa vào nút bấm demo khi thuyết trình.
    """
    return [
        {
            "id": "scenario_1",
            "title": "Kịch bản 1: Đăng ký khám sức khỏe định kỳ",
            "glosses": ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"],
            "translation": "Tôi muốn đăng ký khám sức khỏe.",
            "description": "Trường hợp hành chính tiêu chuẩn, không có triệu chứng cấp tính."
        },
        {
            "id": "scenario_2",
            "title": "Kịch bản 2: Bị đau bụng từ hôm qua",
            "glosses": ["TÔI", "ĐAU-BỤNG", "HÔM-QUA", "NHIỀU"],
            "translation": "Tôi bị đau bụng nhiều từ hôm qua.",
            "description": "Báo triệu chứng có vị trí, thời gian khởi phát nhưng chưa rõ tiền sử dị ứng thuốc."
        },
        {
            "id": "scenario_3",
            "title": "Kịch bản 3: Hỏi về thời gian chờ khám",
            "glosses": ["TÔI", "HẸN", "TRƯỚC", "CHƯA"],
            "translation": "Tôi có phải chờ lâu không?",
            "description": "Hỏi thông tin lịch hẹn, hệ thống tự động phản hồi thời gian dự kiến."
        },
        {
            "id": "scenario_4",
            "title": "Kịch bản 4: Cảnh báo cấp cứu khẩn cấp",
            "glosses": ["TÔI", "NGỰC-ĐAU", "KHÓ-THỞ"],
            "translation": "Tôi bị đau tức ngực và rất khó thở.",
            "description": "Kích hoạt cảnh báo đỏ ngay lập tức cho điều dưỡng trực tiếp."
        }
    ]

