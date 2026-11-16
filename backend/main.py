"""
main.py
-------
FastAPI Server cho SignBridge AI (AI4Life) — Pure REST API Backend.
Giao diện người dùng (Kiosk Bệnh nhân & Dashboard Bác sĩ) đã được tách hoàn toàn sang ứng dụng React (`frontend/`).
"""

import json
import os
import socket
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from schemas import SemanticFrame, ParseRequest, RecognizeResponse, RecognitionStatus, IntentType
from semantic_parser import parse_semantic_frame
from ai_engine import ai_engine
from vsl_synthesizer import vsl_synthesizer
from patient_reply_helper import (
    _heuristic_to_vsl_order,
    suggest_patient_quick_replies,
    suggest_patient_quick_reply_items,
)
from vsl_text_helper import format_vsl_sentence
import gemini_client

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
SERVED_TICKETS: Dict[str, Dict] = {}

# Đọc dataset.json để phục vụ chế độ demo các ca có sẵn & truy xuất keypoints .npy
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_JSON_PATH = BASE_DIR / "AI" / "data" / "dataset.json"
KEYPOINTS_DIR = BASE_DIR / "AI" / "data" / "keypoints"
DATASET_SAMPLES = {}
SENTENCE_SAMPLE_MAP = {}

if DATASET_JSON_PATH.exists():
    try:
        with open(DATASET_JSON_PATH, encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                sid = item.get("id")
                if not sid:
                    continue
                sent_prefix = sid.split("_")[0]
                entry = {
                    "id": sid,
                    "sentence_id": sent_prefix,
                    "gloss_sequence": [g for g in item.get("gloss_sequence", []) if g],
                    "translation": item.get("translation", ""),
                    "duration_sec": item.get("duration_sec", 0),
                    "gloss_frame_boundaries": item.get("gloss_frame_boundaries", []),
                }
                DATASET_SAMPLES[sid] = entry
                if sid.endswith("_F") and (KEYPOINTS_DIR / f"{sid}.npy").exists():
                    if sent_prefix not in SENTENCE_SAMPLE_MAP:
                        SENTENCE_SAMPLE_MAP[sent_prefix] = entry
        print(f"[Backend] Đã nạp {len(SENTENCE_SAMPLE_MAP)} mẫu câu chuẩn từ dataset.json")
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


def _detect_lan_ip() -> Optional[str]:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except Exception:
        pass
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    return None


@app.get("/api/network-info")
def api_network_info():
    """Trả về địa chỉ IP mạng LAN của máy chủ để tạo mã QR cho điện thoại quét trực tiếp."""
    return {
        "lan_ip": _detect_lan_ip(),
    }


@app.post("/api/parse", response_model=SemanticFrame)
def api_parse(req: ParseRequest):
    """
    Phân tích trực tiếp từ chuỗi Gloss hoặc Câu dịch tiếng Việt thành phiếu y tế.
    """
    if not req.gloss_sequence and not req.translation:
        raise HTTPException(status_code=400, detail="Cần cung cấp ít nhất chuỗi Gloss hoặc Câu dịch.")

    
    print(f"[Backend] Đang phân tích chuỗi gloss: {req.gloss_sequence}")
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
            pred = ai_engine.predict_video(tmp_path, original_filename=video.filename)
            is_recognized = pred["is_recognized"]
            recognition_status = RecognitionStatus(pred["recognition_status"])
            fallback_message = pred["fallback_message"]
            glosses = pred["gloss_sequence"]
            translation = pred["translation"]
            confidence = pred["confidence"]
            extracted_frames = pred.get("extracted_frames")
            diagnostics = pred.get("diagnostics")
        except Exception as e:
            print(f"[Backend] Lỗi nhận diện video: {e}")
            is_recognized = False
            recognition_status = RecognitionStatus.INVALID_VIDEO
            fallback_message = "Không thể phân tích file video. Vui lòng thử lại hoặc sử dụng công cụ hỗ trợ bên dưới."
            glosses = []
            translation = ""
            confidence = 0.0
            extracted_frames = None
            diagnostics = None
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
        extracted_frames = None
        diagnostics = None

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
        vsl_text=format_vsl_sentence(glosses) if is_recognized else None,
        confidence=confidence,
        semantic_frame=frame,
        extracted_frames=extracted_frames,
        diagnostics=diagnostics
    )


class ConfirmRequest(BaseModel):
    ticket_id: Optional[str] = None
    patient_name: Optional[str] = "Bệnh nhân VSL"
    status: str = "confirmed"  # "confirmed" (Đúng) | "edited" (Đã sửa) | "need_help" (Gọi hỗ trợ)
    confirmed_text: str
    gloss_sequence: Optional[List[str]] = None
    vsl_text: Optional[str] = None
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

    created_at = datetime.now().strftime("%H:%M:%S")
    resolved_vsl_text = req.vsl_text or format_vsl_sentence(req.gloss_sequence)
    if not resolved_vsl_text and req.confirmed_text:
        plan = vsl_synthesizer.preview_gloss_plan(req.confirmed_text)
        resolved_vsl_text = plan.get("vsl_text") or _heuristic_to_vsl_order(req.confirmed_text)

    record = {
        "ticket_number": ticket_number,
        "patient_name": req.patient_name or "Bệnh nhân VSL",
        "status": req.status,
        "confirmed_text": req.confirmed_text,
        "gloss_sequence": req.gloss_sequence or [],
        "vsl_text": resolved_vsl_text,
        "confidence": req.confidence or 0.96,
        "semantic_frame": req.semantic_frame.model_dump() if hasattr(req.semantic_frame, "model_dump") else req.semantic_frame.dict(),
        "created_at": created_at,
        "qr_pass_enabled": False,
        "call_status": "waiting",
        "assigned_room": None,
        "called_at": None,
        "called_at_ts": None,
        "on_the_way_at": None,
        "call_count": 0,
        "call_vsl_text": None,
        "doctor_reply": None,
        "messages": [
            {
                "id": 1,
                "sender": "patient",
                "text": req.confirmed_text,
                "vsl_text": resolved_vsl_text,
                "source": req.status,
                "gloss_sequence": req.gloss_sequence or [],
                "timestamp": created_at,
            }
        ],
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
    category: Optional[str] = None
    override_glosses: Optional[List[str]] = None
    send_vsl: bool = True


class PatientAckRequest(BaseModel):
    action: str = "understood"  # "understood", "yes", "no", "need_help"
    note: Optional[str] = None


class PatientMessageRequest(BaseModel):
    text: str
    source: str = "vsl"  # "vsl" | "body_map" | "quick_reply" | "text"
    gloss_sequence: Optional[List[str]] = None
    vsl_text: Optional[str] = None


def _match_vsl_sample_id(message: str) -> Optional[str]:
    """Tìm sample_id trong VSL-GH có nội dung gần nhất với chỉ dẫn của bác sĩ để phát minh họa."""
    msg_norm = message.lower().strip(" ?!.,")
    if not msg_norm or not SENTENCE_SAMPLE_MAP:
        return None
    msg_words = set(msg_norm.split())
    best_id = None
    best_score = 0.0
    for sample in SENTENCE_SAMPLE_MAP.values():
        trans = (sample.get("translation") or "").lower().strip(" ?!.,")
        if not trans:
            continue
        if msg_norm == trans or msg_norm in trans or trans in msg_norm:
            return sample["id"]
        trans_words = set(trans.split())
        if not trans_words:
            continue
        overlap = len(msg_words & trans_words) / max(len(msg_words | trans_words), 1)
        if overlap > best_score and overlap >= 0.45:
            best_score = overlap
            best_id = sample["id"]
    return best_id


class VslSynthesizeRequest(BaseModel):
    text: str
    override_glosses: Optional[List[str]] = None


class CallPatientRequest(BaseModel):
    room_name: str = "Phòng Tiếp Nhận 1"
    clinician_name: Optional[str] = "NV. Bàn Tiếp Nhận"
    mode: str = "calling"  # "pre_alert" | "calling"


class QrPassToggleRequest(BaseModel):
    enabled: bool = True


@app.get("/api/llm-status")
def api_llm_status():
    """Kiểm tra trạng thái kết nối Gemini API cho tầng Few-shot RAG."""
    return gemini_client.get_status()


@app.get("/api/vsl-glosses")
def api_vsl_glosses():
    """Trả về danh sách các từ/gloss có sẵn khung xương để nhân viên chỉnh sửa trước khi gửi."""
    return {"glosses": vsl_synthesizer.list_available_glosses()}


@app.post("/api/vsl-preview")
def api_vsl_preview(req: VslSynthesizeRequest):
    """Xem trước chuỗi Gloss VSL & từ ngoài từ điển trước khi nhân viên xác nhận gửi."""
    return vsl_synthesizer.preview_gloss_plan(req.text)


@app.post("/api/vsl-synthesize")
def api_vsl_synthesize(req: VslSynthesizeRequest):
    """
    Tổng hợp chuỗi khung xương VSL (khớp nguyên câu VSL-GH hoặc ghép từ 368 gloss thật)
    từ câu phản hồi tiếng Việt hoặc chuỗi Gloss đã được nhân viên xác nhận.
    """
    return vsl_synthesizer.synthesize(req.text, override_glosses=req.override_glosses)


@app.post("/api/queue/{ticket_number}/reply")
def api_doctor_reply(ticket_number: str, req: DoctorReplyRequest):
    """
    Bác sĩ gửi phản hồi trực quan 1 chạm cho bệnh nhân tại Kiosk.
    Tự động phân loại danh mục (category) và lập kế hoạch tổng hợp VSL (nguyên câu hoặc ghép gloss).
    """
    msg = req.message.lower()
    cat = req.category
    if not cat:
        if any(w in msg for w in ["bhyt", "cccd", "thẻ", "giấy tờ", "bảo hiểm"]):
            cat = "insurance"
        elif any(w in msg for w in ["bàn", "phòng", "sang", "đến", "bên cạnh"]):
            cat = "direction"
        elif any(w in msg for w in ["huyết áp", "nhiệt độ", "sinh hiệu", "thở", "đo"]):
            cat = "vital_signs"
        elif any(w in msg for w in ["cấp cứu", "nguy kịch", "ngay lập tức", "khẩn cấp"]):
            cat = "emergency"
        elif (
            not any(w in msg for w in ["sao", "gì", "đâu", "nào", "bao lâu", "khi nào", "thế nào", "mấy"])
            and (
                ("có" in msg.split() and ("không" in msg.split() or "chưa" in msg.split()))
                or msg.strip(" ?!.").endswith(("không", "chưa", "phải không", "được không"))
            )
        ):
            cat = "question_yes_no"
        else:
            cat = "general"

    replied_at = datetime.now().strftime("%H:%M:%S")
    if not req.send_vsl:
        vsl_plan = {
            "mode": "text_only",
            "matched_sample_id": None,
            "vsl_glosses": [],
            "missing_terms": [],
        }
    elif req.override_glosses is not None:
        vsl_plan = {
            "mode": "stitched" if req.override_glosses else "text_only",
            "matched_sample_id": None,
            "vsl_glosses": req.override_glosses,
            "missing_terms": [],
        }
    else:
        vsl_plan = vsl_synthesizer.preview_gloss_plan(req.message)

    matched_sample_id = vsl_plan["matched_sample_id"] or (_match_vsl_sample_id(req.message) if req.send_vsl else None)
    patient_quick_reply_items = suggest_patient_quick_reply_items(req.message)
    patient_quick_replies = [item["text"] for item in patient_quick_reply_items]

    # Luôn chuẩn bị bản chữ theo ngữ pháp VSL dễ đọc ngay cả khi tắt phát khung xương
    if vsl_plan.get("vsl_glosses"):
        reply_vsl_text = format_vsl_sentence(
            vsl_plan["vsl_glosses"],
            missing_terms=vsl_plan.get("missing_terms"),
        )
    else:
        readable_plan = vsl_synthesizer.preview_gloss_plan(req.message)
        reply_vsl_text = readable_plan.get("vsl_text") or _heuristic_to_vsl_order(req.message)

    reply_payload = {
        "ticket_number": ticket_number,
        "message": req.message,
        "vsl_text": reply_vsl_text,
        "clinician_name": req.clinician_name,
        "category": cat,
        "matched_sample_id": matched_sample_id,
        "vsl_mode": vsl_plan["mode"],
        "vsl_glosses": vsl_plan["vsl_glosses"],
        "missing_terms": vsl_plan["missing_terms"],
        "patient_quick_replies": patient_quick_replies,
        "patient_quick_reply_items": patient_quick_reply_items,
        "send_vsl": req.send_vsl,
        "replied_at": replied_at,
        "patient_ack": None
    }
    DOCTOR_REPLIES[ticket_number] = reply_payload
    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            c["doctor_reply"] = reply_payload
            msgs = c.setdefault("messages", [])
            msgs.append({
                "id": len(msgs) + 1,
                "sender": "clinician",
                "sender_name": req.clinician_name,
                "text": req.message,
                "vsl_text": reply_vsl_text,
                "category": cat,
                "matched_sample_id": matched_sample_id,
                "vsl_mode": vsl_plan["mode"],
                "vsl_glosses": vsl_plan["vsl_glosses"],
                "missing_terms": vsl_plan["missing_terms"],
                "patient_quick_replies": patient_quick_replies,
                "patient_quick_reply_items": patient_quick_reply_items,
                "send_vsl": req.send_vsl,
                "timestamp": replied_at,
            })
            break
    return {"success": True, "reply": reply_payload}


@app.post("/api/queue/{ticket_number}/ack")
def api_patient_ack(ticket_number: str, req: PatientAckRequest):
    """
    Bệnh nhân tại Kiosk bấm nút phản hồi 1 chạm (Đã hiểu / Có / Không / Cần giúp)
    gửi tín hiệu xác nhận trực tiếp ngược về Bàn Tiếp Nhận.
    """
    action_labels = {
        "understood": "Đã hiểu & Đang thực hiện",
        "yes": "CÓ / ĐÚNG",
        "no": "KHÔNG",
        "need_help": "Chưa hiểu — Cần người đến hỗ trợ trực tiếp"
    }
    action_vsl_labels = {
        "understood": "Tôi · hiểu rồi · làm ngay",
        "yes": "Có / Đúng",
        "no": "Không",
        "need_help": "Tôi · hiểu chưa · cần người giúp",
    }
    label = req.note or action_labels.get(req.action, req.action)
    ack_vsl_text = (
        action_vsl_labels.get(req.action)
        if not req.note
        else _heuristic_to_vsl_order(req.note)
    )
    acked_at = datetime.now().strftime("%H:%M:%S")
    ack_data = {
        "action": req.action,
        "note": label,
        "acked_at": acked_at
    }

    if ticket_number in DOCTOR_REPLIES:
        DOCTOR_REPLIES[ticket_number]["patient_ack"] = ack_data

    found = False
    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            if not c.get("doctor_reply"):
                c["doctor_reply"] = {"ticket_number": ticket_number, "message": "", "patient_ack": ack_data}
            else:
                c["doctor_reply"]["patient_ack"] = ack_data
            msgs = c.setdefault("messages", [])
            msgs.append({
                "id": len(msgs) + 1,
                "sender": "patient",
                "text": label,
                "vsl_text": ack_vsl_text,
                "source": "ack",
                "gloss_sequence": [],
                "timestamp": acked_at,
            })
            found = True
            break

    if not found and ticket_number not in DOCTOR_REPLIES:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phiếu {ticket_number}")

    return {"success": True, "patient_ack": ack_data}


@app.post("/api/queue/{ticket_number}/patient-message")
def api_patient_message(ticket_number: str, req: PatientMessageRequest):
    """
    Bệnh nhân trả lời tiếp trong phiên đối thoại 2 chiều bằng Ký hiệu VSL, Sơ đồ cơ thể hoặc văn bản.
    """
    sent_at = datetime.now().strftime("%H:%M:%S")
    resolved_vsl = req.vsl_text or format_vsl_sentence(req.gloss_sequence)
    if not resolved_vsl and req.text:
        plan = vsl_synthesizer.preview_gloss_plan(req.text)
        resolved_vsl = plan.get("vsl_text") or _heuristic_to_vsl_order(req.text)

    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            msgs = c.setdefault("messages", [])
            msg_item = {
                "id": len(msgs) + 1,
                "sender": "patient",
                "text": req.text,
                "vsl_text": resolved_vsl,
                "source": req.source,
                "gloss_sequence": req.gloss_sequence or [],
                "timestamp": sent_at,
            }
            msgs.append(msg_item)
            updated_frame = parse_semantic_frame(
                gloss_sequence=req.gloss_sequence,
                translation=req.text,
                dialogue_history=msgs,
            )
            c["semantic_frame"] = (
                updated_frame.model_dump()
                if hasattr(updated_frame, "model_dump")
                else updated_frame.dict()
            )
            ack_data = {"action": "understood", "note": req.text, "acked_at": sent_at}
            if c.get("doctor_reply"):
                c["doctor_reply"]["patient_ack"] = ack_data
            if ticket_number in DOCTOR_REPLIES:
                DOCTOR_REPLIES[ticket_number]["patient_ack"] = ack_data
            return {"success": True, "message": msg_item, "semantic_frame": c["semantic_frame"]}
    raise HTTPException(status_code=404, detail=f"Không tìm thấy phiếu {ticket_number}")


@app.post("/api/queue/{ticket_number}/qr-pass")
def api_toggle_qr_pass(ticket_number: str, req: QrPassToggleRequest):
    """
    Nhân viên tiếp nhận chủ động bật hoặc ẩn mã QR Thẻ Chờ Di Động trên màn hình Kiosk
    (chỉ bật khi người bệnh có nhu cầu báo rung/nháy thay loa gọi tên).
    """
    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            c["qr_pass_enabled"] = bool(req.enabled)
            return {
                "success": True,
                "ticket_number": ticket_number,
                "qr_pass_enabled": c["qr_pass_enabled"],
            }
    raise HTTPException(status_code=404, detail=f"Không tìm thấy số phiếu {ticket_number}")


@app.post("/api/queue/{ticket_number}/call")
def api_call_patient(ticket_number: str, req: CallPatientRequest):
    """
    Nhân viên y tế / Bác sĩ kích hoạt gọi bệnh nhân vào phòng.
    Gửi tín hiệu rung + nháy màn hình + hướng dẫn VSL trực tiếp tới Mobile Waiting Pass của bệnh nhân.
    """
    mode = req.mode if req.mode in ("pre_alert", "calling") else "calling"
    room_name = (req.room_name or "").strip() or "Phòng Tiếp Nhận 1"
    called_at = datetime.now().strftime("%H:%M:%S")
    called_at_ts = time.time()

    call_sentence = (
        f"Sắp tới lượt bạn, vui lòng chuẩn bị vào {room_name}."
        if mode == "pre_alert"
        else f"Mời bạn vào {room_name}."
    )
    call_vsl_text = (
        f"Sắp tới lượt · chuẩn bị · {room_name}"
        if mode == "pre_alert"
        else f"Đến lượt bạn · mời vào · {room_name}"
    )

    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            c["call_status"] = mode
            c["assigned_room"] = room_name
            c["called_at"] = called_at
            c["called_at_ts"] = called_at_ts
            c["on_the_way_at"] = None
            c["call_count"] = int(c.get("call_count") or 0) + 1
            c["call_vsl_text"] = call_vsl_text

            msgs = c.setdefault("messages", [])
            msgs.append({
                "id": len(msgs) + 1,
                "sender": "clinician",
                "sender_name": req.clinician_name or "Hệ thống Gọi Số",
                "text": call_sentence,
                "vsl_text": call_vsl_text,
                "category": "direction",
                "send_vsl": False,
                "timestamp": called_at,
            })
            return {
                "success": True,
                "ticket_number": ticket_number,
                "call_status": c["call_status"],
                "assigned_room": room_name,
                "called_at": called_at,
                "called_at_ts": called_at_ts,
                "call_count": c["call_count"],
                "call_vsl_text": call_vsl_text,
            }

    raise HTTPException(status_code=404, detail=f"Không tìm thấy số phiếu {ticket_number}")


@app.post("/api/queue/{ticket_number}/on-the-way")
def api_patient_on_the_way(ticket_number: str):
    """
    Bệnh nhân bấm xác nhận trên Mobile Waiting Pass ('Tôi đã thấy — Đang vào phòng'),
    giúp Dashboard biết người bệnh đã nhận tín hiệu và không bấm nhảy qua lượt.
    """
    acked_at = datetime.now().strftime("%H:%M:%S")
    for c in CLINIC_QUEUE:
        if c["ticket_number"] == ticket_number:
            room_name = c.get("assigned_room") or "phòng khám"
            c["call_status"] = "on_the_way"
            c["on_the_way_at"] = acked_at

            ack_data = {
                "action": "understood",
                "note": f"Đã thấy thông báo gọi lượt — Đang vào {room_name}",
                "acked_at": acked_at,
            }
            if c.get("doctor_reply"):
                c["doctor_reply"]["patient_ack"] = ack_data
            if ticket_number in DOCTOR_REPLIES:
                DOCTOR_REPLIES[ticket_number]["patient_ack"] = ack_data

            msgs = c.setdefault("messages", [])
            msgs.append({
                "id": len(msgs) + 1,
                "sender": "patient",
                "text": f"Tôi đã nhận tín hiệu gọi lượt và đang vào {room_name}.",
                "vsl_text": f"Tôi · thấy rồi · đang đi vào · {room_name}",
                "source": "ack",
                "gloss_sequence": [],
                "timestamp": acked_at,
            })
            return {
                "success": True,
                "ticket_number": ticket_number,
                "call_status": "on_the_way",
                "assigned_room": c.get("assigned_room"),
                "on_the_way_at": acked_at,
            }

    raise HTTPException(status_code=404, detail=f"Không tìm thấy số phiếu {ticket_number}")


@app.get("/api/ticket/{ticket_number}/status")
def api_get_ticket_status(ticket_number: str):
    """
    Endpoint nhẹ cho Mobile Waiting Pass (quét QR từ Kiosk) theo dõi thứ tự và nhận lệnh rung gọi lượt.
    """
    norm_ticket = ticket_number.strip().upper()
    for idx, c in enumerate(CLINIC_QUEUE):
        if c["ticket_number"].upper() == norm_ticket:
            is_emergency = (c.get("semantic_frame") or {}).get("intent") == IntentType.EMERGENCY.value
            return {
                "ticket_number": c["ticket_number"],
                "patient_name": c.get("patient_name", "Bệnh nhân VSL"),
                "call_status": c.get("call_status", "waiting"),
                "assigned_room": c.get("assigned_room"),
                "called_at": c.get("called_at"),
                "called_at_ts": c.get("called_at_ts"),
                "on_the_way_at": c.get("on_the_way_at"),
                "call_count": c.get("call_count", 0),
                "call_vsl_text": c.get("call_vsl_text"),
                "people_ahead": idx,
                "total_waiting": len(CLINIC_QUEUE),
                "is_emergency": is_emergency,
                "created_at": c.get("created_at"),
                "specialty": (c.get("semantic_frame") or {}).get("specialty"),
                "doctor_reply": c.get("doctor_reply"),
            }

    if norm_ticket in SERVED_TICKETS:
        served = SERVED_TICKETS[norm_ticket]
        return {
            "ticket_number": served["ticket_number"],
            "patient_name": served.get("patient_name", "Bệnh nhân VSL"),
            "call_status": "served",
            "assigned_room": served.get("assigned_room"),
            "called_at": served.get("called_at"),
            "called_at_ts": served.get("called_at_ts"),
            "on_the_way_at": served.get("on_the_way_at"),
            "call_count": served.get("call_count", 0),
            "call_vsl_text": served.get("call_vsl_text"),
            "people_ahead": 0,
            "total_waiting": len(CLINIC_QUEUE),
            "is_emergency": False,
            "created_at": served.get("created_at"),
            "doctor_reply": served.get("doctor_reply"),
        }

    raise HTTPException(status_code=404, detail=f"Không tìm thấy số phiếu {ticket_number}")


@app.post("/api/queue/{ticket_number}/serve")
def api_serve_ticket(ticket_number: str):
    """
    Bác sĩ đánh dấu hoàn thành tiếp nhận ca bệnh.
    """
    global SERVED_COUNT
    for i, c in enumerate(CLINIC_QUEUE):
        if c["ticket_number"] == ticket_number:
            served_copy = dict(c)
            served_copy["call_status"] = "served"
            SERVED_TICKETS[ticket_number.upper()] = served_copy
            CLINIC_QUEUE.pop(i)
            SERVED_COUNT += 1
            return {"success": True, "served_count": SERVED_COUNT}
    raise HTTPException(status_code=404, detail=f"Không tìm thấy số phiếu {ticket_number}")


@app.get("/api/sample-scenarios")
def api_get_sample_scenarios():
    """
    Danh sách các kịch bản chuẩn trong bộ dữ liệu VSL-GH (khớp 100% với file .npy thật).
    """
    return [
        {
            "id": "SENT001",
            "category": "Đăng ký khám",
            "title": "Đăng ký khám sức khỏe",
            "glosses": ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"],
            "translation": "Tôi muốn đăng ký khám sức khỏe.",
            "description": "Ký hiệu mẫu SENT001_S01_R01_F.npy trong tập dữ liệu."
        },
        {
            "id": "SENT102",
            "category": "Nội tiêu hóa",
            "title": "Khai báo: Bị đau bụng",
            "glosses": ["TÔI", "BỤNG-ĐAU"],
            "translation": "Tôi bị đau bụng.",
            "description": "Ký hiệu mẫu SENT102_S01_R01_F.npy — Chỉ vùng bụng và biểu cảm đau."
        },
        {
            "id": "SENT110",
            "category": "Nội thần kinh",
            "title": "Khai báo: Bị chóng mặt",
            "glosses": ["TÔI", "CHÓNG-MẶT"],
            "translation": "Tôi bị chóng mặt.",
            "description": "Ký hiệu mẫu SENT110_S01_R01_F.npy — Xoay bàn tay quanh vùng thái dương/đầu."
        },
        {
            "id": "SENT148",
            "category": "Răng Hàm Mặt",
            "title": "Bị sâu răng / Đau răng",
            "glosses": ["TÔI", "RĂNG", "SÂU"],
            "translation": "Tôi bị sâu răng.",
            "description": "Ký hiệu mẫu SENT148_S01_R01_F.npy — Chỉ vào vùng răng hàm."
        },
        {
            "id": "SENT141",
            "category": "Nhãn khoa",
            "title": "Cận thị / Nhìn mờ mắt",
            "glosses": ["TÔI", "CẬN-THỊ"],
            "translation": "Tôi bị cận thị.",
            "description": "Ký hiệu mẫu SENT141_S01_R01_F.npy — Cử chỉ hai ngón tay trước vùng mắt."
        },
        {
            "id": "SENT222",
            "category": "Hợp tác khám",
            "title": "Hỏi bác sĩ: Há miệng ra phải không?",
            "glosses": ["TÔI", "MIỆNG-HÁ", "PHẢI-KHÔNG"],
            "translation": "Tôi há miệng ra phải không?",
            "description": "Ký hiệu mẫu SENT222_S04_R01_F.npy — Giao tiếp hợp tác khám lâm sàng."
        },
        {
            "id": "SENT115",
            "category": "Cấp cứu đỏ",
            "title": "Cấp cứu: Cảm thấy khó thở",
            "glosses": ["TÔI", "CẢM-THẤY", "THỞ-KHÓ"],
            "translation": "Tôi cảm thấy khó thở.",
            "description": "Ký hiệu mẫu SENT115_S01_R01_F.npy — Cảnh báo đỏ ưu tiên tuyệt đối."
        }
    ]


@app.get("/api/sample-keypoints/{sample_id}")
def api_get_sample_keypoints(sample_id: str):
    """
    Trả về chuỗi tọa độ 137 điểm (T, 411) từ file .npy thật trong bộ dữ liệu
    KÈM THEO kết quả chạy suy luận thật qua mô hình PyTorch SLTModel (checkpoint_best.pt).
    Giúp người dùng vừa xem trực quan cách ký hiệu tay trong dataset, vừa kiểm thử AI thật.
    """
    import numpy as np

    # Hỗ trợ truyền cả "SENT001", "EMERGENCY" hoặc "SENT001_S01_R01_F"
    lookup_id = "SENT115" if sample_id == "EMERGENCY" else sample_id
    sent_prefix = lookup_id.split("_")[0]

    entry = DATASET_SAMPLES.get(lookup_id) or SENTENCE_SAMPLE_MAP.get(sent_prefix)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy mẫu {sample_id} trong dataset.json")

    video_id = entry["id"]
    kp_path = KEYPOINTS_DIR / f"{video_id}.npy"
    if not kp_path.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file keypoints {kp_path.name}")

    kp_data = np.load(str(kp_path))
    T = int(len(kp_data))

    # Chạy suy luận THẬT qua mô hình PyTorch SLTModel trên chuỗi .npy này
    pred = ai_engine.predict_keypoints(kp_data, sent_key=sent_prefix)
    glosses = pred["gloss_sequence"] or entry.get("gloss_sequence") or []
    translation = pred["translation"] or entry.get("translation") or ""
    confidence = pred["confidence"]
    is_recognized = pred["is_recognized"]
    recognition_status = RecognitionStatus(pred["recognition_status"])

    frame = parse_semantic_frame(gloss_sequence=glosses, translation=translation)

    return {
        "video_id": video_id,
        "sentence_id": sent_prefix,
        "num_frames": T,
        "fps": 25,
        "ground_truth_glosses": entry.get("gloss_sequence", []),
        "ground_truth_translation": entry.get("translation", ""),
        "gloss_frame_boundaries": entry.get("gloss_frame_boundaries", []),
        "frames": np.round(kp_data, 4).tolist(),
        "recognition": RecognizeResponse(
            sample_id=video_id,
            is_recognized=is_recognized,
            recognition_status=recognition_status,
            fallback_message=pred["fallback_message"],
            gloss_sequence=glosses,
            translation=translation,
            vsl_text=format_vsl_sentence(glosses) if is_recognized else None,
            confidence=confidence,
            semantic_frame=frame,
        ),
    }
