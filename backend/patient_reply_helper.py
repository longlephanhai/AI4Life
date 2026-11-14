"""
patient_reply_helper.py
-----------------------
Sinh danh sách 3–4 nút trả lời nhanh 1-chạm (`patient_quick_replies`) trên Kiosk
khớp theo đúng câu hỏi / hướng dẫn mà nhân viên tiếp nhận vừa gửi xuống.
Giúp bệnh nhân khiếm thính giao tiếp 100% Zero-Typing (không cần gõ bàn phím)
mà câu trả lời gửi lên vẫn chuẩn ngữ pháp để `triage_kb` tự điền slot tức thì.
"""

from collections import OrderedDict
from typing import Dict, List
import gemini_client

_CACHE_LIMIT = 128
_reply_cache: "OrderedDict[str, List[str]]" = OrderedDict()

PATIENT_REPLIES_SCHEMA: Dict[str, object] = {
    "type": "OBJECT",
    "properties": {
        "quick_replies": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        }
    },
    "required": ["quick_replies"],
}


def _match_offline_templates(msg_lower: str) -> List[str]:
    """Khớp nhanh <1ms cho các nhóm câu hỏi phổ biến tại Bàn Tiếp Nhận."""
    if any(w in msg_lower for w in ["dị ứng", "kích ứng"]):
        return [
            "Tôi không bị dị ứng thuốc",
            "Tôi có tiền sử dị ứng thuốc",
            "Tôi không nhớ rõ",
        ]
    if any(w in msg_lower for w in ["uống thuốc", "dùng thuốc", "đơn thuốc"]):
        return [
            "Tôi chưa uống thuốc gì",
            "Tôi đã uống thuốc giảm đau / hạ sốt",
            "Tôi đang uống thuốc khác",
        ]
    if any(w in msg_lower for w in ["khi nào", "bao lâu", "mấy ngày", "hôm nào", "bắt đầu", "thời gian"]):
        return [
            "Mới bị hôm nay",
            "Khoảng 2 ngày nay",
            "Khoảng 5 ngày nay",
            "Hơn 1 tuần rồi",
        ]
    if any(w in msg_lower for w in ["mức độ", "nặng hay nhẹ", "nhiều không", "dữ dội", "nhiều hay ít"]):
        return [
            "Mức độ nhẹ / âm ỉ",
            "Mức độ vừa",
            "Đau nặng / dữ dội",
        ]
    if any(w in msg_lower for w in ["bhyt", "cccd", "bảo hiểm", "giấy tờ", "sổ khám"]):
        return [
            "Tôi có mang thẻ BHYT / CCCD",
            "Tôi quên mang thẻ BHYT",
            "Tôi đăng ký khám không dùng BHYT",
        ]
    if any(w in msg_lower for w in ["sang phòng", "đến bàn", "ngồi chờ", "ra ghế", "lấy số"]):
        return [
            "Đã hiểu, tôi di chuyển ngay",
            "Cần nhân viên chỉ đường giúp tôi",
        ]
    if any(w in msg_lower for w in ["vị trí", "ở đâu", "chỗ nào", "chổ nào", "bên trái", "bên phải"]):
        return [
            "Đau ở bên trái",
            "Đau ở bên phải",
            "Đau cả hai bên / ở giữa",
        ]
    return []


def _clean_replies(items: List[str], limit: int = 4) -> List[str]:
    result: List[str] = []
    seen = set()
    for raw in items:
        text = str(raw or "").strip()
        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())
        result.append(text)
        if len(result) >= limit:
            break
    return result


def suggest_patient_quick_replies(doctor_message: str) -> List[str]:
    """
    Sinh 3–4 nút trả lời ngắn, chuẩn tiếng Việt cho bệnh nhân bấm 1 chạm trên Kiosk:
    - Tầng 1: Khớp mẫu chuẩn lâm sàng (<1ms offline).
    - Tầng 2: Nếu là câu hỏi tự do/chuyên biệt mới của nhân viên và có Gemini,
      gọi Gemini tạo nút trả lời sát ngữ cảnh câu hỏi (có cache + fallback offline).
    """
    msg = (doctor_message or "").strip()
    if not msg:
        return []

    msg_lower = msg.lower()
    preset = _match_offline_templates(msg_lower)
    if preset:
        return preset

    cache_key = msg_lower
    if cache_key in _reply_cache:
        _reply_cache.move_to_end(cache_key)
        return list(_reply_cache[cache_key])

    if gemini_client.is_configured():
        system_prompt = (
            "Bạn hỗ trợ thiết kế nút bấm trả lời nhanh cho bệnh nhân khiếm thính tại Kiosk bệnh viện (Zero-Typing).\n"
            "Nhiệm vụ: Đọc câu hỏi hoặc hướng dẫn của nhân viên y tế và tạo đúng 3 nút trả lời ngắn gọn "
            "(mỗi nút <= 9 từ, viết ở ngôi 'Tôi ...' hoặc câu khẳng/phủ định rõ nghĩa, dễ hiểu cho bệnh nhân).\n"
            "Ví dụ:\n"
            "- Nhân viên: 'Hôm nay bạn đã ăn sáng chưa?' -> ['Tôi chưa ăn sáng (đang nhịn ăn)', 'Tôi đã ăn sáng rồi', 'Tôi chỉ uống nước']\n"
            "- Nhân viên: 'Bạn có bị sốt cao hay ớn lạnh không?' -> ['Tôi đang sốt và ớn lạnh', 'Tôi chỉ hơi ấm người, không sốt cao', 'Tôi không bị sốt']\n"
            "- Nhân viên: 'Bạn bị mất ngủ có kèm căng thẳng không?' -> ['Có, tôi đang rất căng thẳng', 'Không căng thẳng, chỉ khó vào giấc', 'Tôi hay thức dậy giữa đêm']"
        )
        user_prompt = f"Câu của nhân viên y tế gửi tới Kiosk:\n\"{msg}\"\n\nHãy trả về JSON gồm 3 lựa chọn trả lời trong `quick_replies`."
        data = gemini_client.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=PATIENT_REPLIES_SCHEMA,
            temperature=0.2,
            timeout=5.0,
        )
        if data and isinstance(data.get("quick_replies"), list):
            cleaned = _clean_replies(data["quick_replies"], limit=4)
            if cleaned:
                _reply_cache[cache_key] = cleaned
                if len(_reply_cache) > _CACHE_LIMIT:
                    _reply_cache.popitem(last=False)
                return cleaned

    # Fallback offline an toàn cho câu hỏi/chỉ dẫn bất kỳ
    is_question = "?" in msg or any(w in msg_lower.split() for w in ["không", "chưa", "gì", "nào", "đâu"])
    if is_question:
        return ["Có / Đúng vậy", "Không có", "Tôi chưa rõ, cần hỗ trợ"]
    return ["Đã hiểu, tôi thực hiện ngay", "Cần nhân viên hỗ trợ thêm"]

