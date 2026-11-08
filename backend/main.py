"""
main.py
-------
FastAPI Server cho SignBridge AI (AI4Life) — Pure REST API Backend.
Giao diện người dùng (Kiosk Bệnh nhân & Dashboard Bác sĩ) đã được tách hoàn toàn sang ứng dụng React (`frontend/`).
"""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from schemas import SemanticFrame, ParseRequest, RecognizeResponse, RecognitionStatus, IntentType
from semantic_parser import parse_semantic_frame
from ai_engine import ai_engine

app = FastAPI(
    title="SignBridge AI — Medical Reception API",
    description="API hỗ trợ tiếp nhận y tế ban đầu cho người khiếm thính sử dụng Ngôn ngữ ký hiệu VSL",
    version="2.0.0"
)

# Cho phép Frontend React gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database lưu tạm danh sách ca khám (In-memory storage cho demo)
CLINIC_QUEUE: List[Dict] = []
SERVED_COUNT: int = 0
TICKET_COUNTER: int = 0
DOCTOR_REPLIES: Dict[str, Dict] = {}

# Đọc dataset.json để phục vụ chế độ demo các ca có sẵn
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
def root_info():
    return {
        "service": "SignBridge AI — Medical Reception REST API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "frontend_note": "UI is served separately by the React application in /frontend"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "samples_loaded": len(DATASET_SAMPLES),
        "ai_engine": {
            "is_ready": ai_engine.is_ready,
            "checkpoint": str(ai_engine.checkpoint_path) if ai_engine.checkpoint_path else None,
            "device": str(ai_engine.device) if ai_engine.device else None
        }
    }


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
    2. Nếu upload video: Xử lý qua pipeline nhận diện AI thực tế kèm bộ lọc an toàn (không đoán bậy).
    """
    is_recognized = True
    recognition_status = RecognitionStatus.RECOGNIZED
    fallback_message = None

    if sample_id and sample_id in DATASET_SAMPLES:
        sample = DATASET_SAMPLES[sample_id]
        glosses = sample["gloss_sequence"]
        translation = sample["translation"]
        confidence = 0.96
    elif video:
        tmp_path = None
        try:
            suffix = Path(video.filename).suffix if video.filename else ".mp4"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await video.read()
                tmp.write(content)
                tmp_path = tmp.name
            pred = ai_engine.predict_video(tmp_path)
            is_recognized = pred["is_recognized"]
            recognition_status = RecognitionStatus(pred["recognition_status"])
            fallback_message = pred["fallback_message"]
            glosses = pred["gloss_sequence"]
            translation = pred["translation"]
            confidence = pred["confidence"]
        except Exception as e:
            print(f"[Backend] Lỗi nhận diện video: {e}")
            is_recognized = False
            recognition_status = RecognitionStatus.INVALID_VIDEO
            fallback_message = "Không thể phân tích file video. Vui lòng thử lại hoặc sử dụng công cụ hỗ trợ bên dưới."
            glosses = []
            translation = ""
            confidence = 0.0
        finally:
            if tmp_path:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    else:
        is_recognized = False
        recognition_status = RecognitionStatus.INVALID_VIDEO
        fallback_message = "Chưa có dữ liệu video hoặc mẫu ký hiệu."
        glosses = []
        translation = ""
        confidence = 0.0

    if is_recognized and translation:
        frame = parse_semantic_frame(gloss_sequence=glosses, translation=translation)
    else:
        frame = SemanticFrame(
            intent=IntentType.GENERAL,
            specialty="Bàn Tiếp Nhận & Hỗ Trợ",
            visit_reason="Cần hỗ trợ nhận diện / giao tiếp bổ sung",
            symptoms=[],
            needs_human_review=True,
            review_reasons=[fallback_message or "Không nhận diện được ký hiệu đủ độ tin cậy an toàn"],
            summary_for_clinician="Bệnh nhân thực hiện ký hiệu ngoài bộ từ vựng hoặc độ tin cậy thấp. Cần hỗ trợ qua bảng tương tác hoặc nhân viên y tế.",
            patient_confirmation_text=fallback_message or "Hệ thống chưa nhận diện chắc chắn ký hiệu vừa rồi.",
            suggested_action="Mời chọn phương thức thay thế (Thử lại / Chọn trên sơ đồ cơ thể / Câu giao tiếp có sẵn / Nhập văn bản / Gọi hỗ trợ)",
            doctor_quick_responses=[
                "Mời bạn chỉ vào vị trí đau trên sơ đồ cơ thể",
                "Mời bạn nhập nội dung hoặc chọn câu có sẵn trên màn hình",
                "Nhân viên hỗ trợ đang ra tiếp nhận trực tiếp"
            ]
        )

    return RecognizeResponse(
        sample_id=sample_id,
        is_recognized=is_recognized,
        recognition_status=recognition_status,
        fallback_message=fallback_message,
        gloss_sequence=glosses,
        translation=translation,
        confidence=confidence,
        semantic_frame=frame
    )


class ConfirmRequest(BaseModel):
    ticket_id: Optional[str] = None
    patient_name: Optional[str] = "Bệnh nhân VSL"
    status: str = "confirmed"  # "confirmed" (Đúng) | "edited" (Đã sửa) | "need_help" (Gọi hỗ trợ)
    confirmed_text: str
    gloss_sequence: Optional[List[str]] = None
    confidence: Optional[float] = 0.96
    semantic_frame: SemanticFrame


@app.post("/api/confirm")
def api_confirm(req: ConfirmRequest):
    """
    Người bệnh bấm xác nhận [ĐÚNG, GỬI ĐI] ➔ Đẩy vào hàng đợi tiếp nhận của nhân viên y tế.
    """
    global TICKET_COUNTER
    TICKET_COUNTER += 1
    is_emergency = req.semantic_frame.intent == IntentType.EMERGENCY
    prefix = "E" if is_emergency else "A"
    ticket_number = f"{prefix}{TICKET_COUNTER:03d}"

    record = {
        "ticket_number": ticket_number,
        "patient_name": req.patient_name or "Bệnh nhân VSL",
        "status": req.status,
        "confirmed_text": req.confirmed_text,
        "gloss_sequence": req.gloss_sequence or [],
        "confidence": req.confidence or 0.96,
        "semantic_frame": req.semantic_frame.model_dump() if hasattr(req.semantic_frame, "model_dump") else req.semantic_frame.dict(),
        "created_at": datetime.now().strftime("%H:%M:%S"),
        "doctor_reply": None
    }
    # Cấp cứu đưa lên đầu hàng đợi
    if is_emergency:
        CLINIC_QUEUE.insert(0, record)
    else:
        CLINIC_QUEUE.append(record)

    return {
        "success": True,
        "ticket_number": record["ticket_number"],
        "created_at": record["created_at"],
        "message": f"Đã gửi thành công! Số thứ tự của bạn là {record['ticket_number']}."
    }


@app.get("/api/queue")
def api_get_queue():
    """
    Màn hình Bác sĩ / Nhân viên tiếp nhận lấy danh sách các ca bệnh nhân vừa gửi.
    """
    return {
        "total_cases": len(CLINIC_QUEUE),
        "served_count": SERVED_COUNT,
        "cases": CLINIC_QUEUE,
        "doctor_replies": DOCTOR_REPLIES
    }


class DoctorReplyRequest(BaseModel):
    message: str
    clinician_name: Optional[str] = "NV. Bàn Tiếp Nhận"


@app.post("/api/queue/{ticket_number}/reply")
def api_doctor_reply(ticket_number: str, req: DoctorReplyRequest):
    """
    Bác sĩ gửi phản hồi trực quan 1 chạm cho bệnh nhân tại Kiosk.
    """
    reply_payload = {
        "ticket_number": ticket_number,
        "message": req.message,
        "clinician_name": req.clinician_name,
        "replied_at": datetime.now().strftime("%H:%M:%S")
    }
    DOCTOR_REPLIES[ticket_number] = reply_payload
    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            c["doctor_reply"] = reply_payload
            break
    return {"success": True, "reply": reply_payload}


@app.post("/api/queue/{ticket_number}/serve")
def api_serve_ticket(ticket_number: str):
    """
    Bác sĩ đánh dấu hoàn thành tiếp nhận ca bệnh.
    """
    global SERVED_COUNT
    for i, c in enumerate(CLINIC_QUEUE):
        if c["ticket_number"] == ticket_number:
            CLINIC_QUEUE.pop(i)
            SERVED_COUNT += 1
            return {"success": True, "served_count": SERVED_COUNT}
    raise HTTPException(status_code=404, detail=f"Không tìm thấy số phiếu {ticket_number}")


@app.get("/api/sample-scenarios")
def api_get_sample_scenarios():
    """
    Danh sách các kịch bản chuẩn bị sẵn để Frontend đưa vào nút bấm demo.
    """
    return [
        {
            "id": "SENT001",
            "category": "Đăng ký khám",
            "title": "Đăng ký khám sức khỏe định kỳ",
            "glosses": ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"],
            "translation": "Tôi muốn đăng ký khám sức khỏe.",
            "description": "Trường hợp hành chính tiêu chuẩn, không có triệu chứng cấp tính."
        },
        {
            "id": "SENT003",
            "category": "Nội tiêu hóa",
            "title": "Bị đau bụng nhiều từ hôm qua",
            "glosses": ["TÔI", "ĐAU-BỤNG", "HÔM-QUA", "NHIỀU"],
            "translation": "Tôi bị đau bụng nhiều từ hôm qua.",
            "description": "Báo triệu chứng có vị trí, thời gian khởi phát nhưng chưa rõ tiền sử dị ứng thuốc."
        },
        {
            "id": "SENT113",
            "category": "Răng Hàm Mặt",
            "title": "Bị sâu răng đau buốt",
            "glosses": ["TÔI", "RĂNG", "SÂU"],
            "translation": "Tôi bị sâu răng đau buốt.",
            "description": "Phân luồng trực tiếp về chuyên khoa Răng - Hàm - Mặt."
        },
        {
            "id": "SENT141",
            "category": "Nhãn khoa",
            "title": "Cận thị nhìn mờ mắt",
            "glosses": ["TÔI", "CẬN-THỊ"],
            "translation": "Tôi bị cận thị nhìn mờ mắt.",
            "description": "Phân luồng về chuyên khoa Mắt để đo khúc xạ."
        },
        {
            "id": "SENT240",
            "category": "Cận lâm sàng",
            "title": "Chỉ định siêu âm tim",
            "glosses": ["TÔI", "SIÊU-ÂM", "TIM"],
            "translation": "Tôi được chỉ định siêu âm tim.",
            "description": "Hướng dẫn người bệnh di chuyển tới khu vực Chẩn đoán hình ảnh."
        },
        {
            "id": "SENT222",
            "category": "Hợp tác khám",
            "title": "Xác nhận thao tác: Há miệng",
            "glosses": ["TÔI", "MIỆNG-HÁ", "PHẢI-KHÔNG"],
            "translation": "Tôi há miệng ra phải không?",
            "description": "Hỗ trợ giao tiếp hai chiều trong phòng khám lâm sàng."
        },
        {
            "id": "EMERGENCY",
            "category": "Cấp cứu đỏ",
            "title": "Cảnh báo cấp cứu: Đau ngực, khó thở",
            "glosses": ["TÔI", "NGỰC-ĐAU", "KHÓ-THỞ"],
            "translation": "Tôi bị đau tức ngực và rất khó thở.",
            "description": "Kích hoạt cảnh báo đỏ ưu tiên tuyệt đối cho điều dưỡng trực."
        }
    ]
