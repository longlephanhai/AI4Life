"""
patient_reply_helper.py
-----------------------
Sinh danh sách 3–4 nút trả lời nhanh 1-chạm (`patient_quick_replies` & `patient_quick_reply_items`)
trên Kiosk khớp theo đúng câu hỏi / hướng dẫn mà nhân viên tiếp nhận vừa gửi xuống.
Mỗi lựa chọn có 2 dạng hiển thị:
- `text`: Tiếng Việt chuẩn (để đẩy vào hồ sơ & `triage_kb`).
- `vsl_text`: Trật tự ngữ pháp VSL dễ đọc (Chủ ngữ → Nội dung → Phủ định/Từ hỏi ở cuối).
"""

from collections import OrderedDict
import re
from typing import Dict, List
import gemini_client

_CACHE_LIMIT = 128
_reply_cache: "OrderedDict[str, List[Dict[str, str]]]" = OrderedDict()

PATIENT_REPLIES_SCHEMA: Dict[str, object] = {
    "type": "OBJECT",
    "properties": {
        "quick_replies": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "text": {"type": "STRING"},
                    "vsl_text": {"type": "STRING"},
                },
                "required": ["text", "vsl_text"],
            },
        }
    },
    "required": ["quick_replies"],
}


def _item(text: str, vsl_text: str) -> Dict[str, str]:
    return {"text": text, "vsl_text": vsl_text}


def _heuristic_to_vsl_order(text: str) -> str:
    """Chuyển nhanh một câu trả lời ngắn tiếng Việt sang trật tự VSL thân thiện nếu chưa có sẵn."""
    s = (text or "").strip().rstrip(".!")
    if not s:
        return ""
    lower = s.lower()

    # Đưa phủ định "không bị / chưa / không" về cuối câu theo trật tự VSL
    m_neg = re.match(
        r"^(tôi\s+)?(?:không\s+bị|không\s+có|chưa\s+từng|chưa|không)\s+(.+)$",
        lower,
    )
    if m_neg:
        subj = "Tôi · " if m_neg.group(1) else ""
        neg = "chưa" if "chưa" in lower.split()[:3] else "không"
        body = m_neg.group(2).strip()
        return f"{subj}{body} · {neg}".strip()

    m_has = re.match(r"^(tôi\s+)?(?:đã|đang|có)\s+(.+)$", lower)
    if m_has:
        subj = "Tôi · " if m_has.group(1) else ""
        tail = "rồi" if lower.startswith(("đã ", "tôi đã ")) else ("đang" if "đang " in lower[:10] else "có")
        body = m_has.group(2).strip()
        return f"{subj}{body} · {tail}".strip()

    if lower.startswith("tôi "):
        return f"Tôi · {s[4:].strip()}"
    return s


def _match_offline_templates(msg_lower: str) -> List[Dict[str, str]]:
    """Khớp nhanh <1ms cho các nhóm câu hỏi phổ biến tại Bàn Tiếp Nhận."""
    if any(w in msg_lower for w in ["dị ứng", "kích ứng"]):
        return [
            _item("Tôi không bị dị ứng thuốc", "Tôi · dị ứng thuốc · không"),
            _item("Tôi có tiền sử dị ứng thuốc", "Tôi · dị ứng thuốc · có"),
            _item("Tôi không nhớ rõ", "Tôi · nhớ · không rõ"),
        ]
    if any(w in msg_lower for w in ["uống thuốc", "dùng thuốc", "đơn thuốc"]):
        return [
            _item("Tôi chưa uống thuốc gì", "Tôi · thuốc · uống · chưa"),
            _item("Tôi đã uống thuốc giảm đau / hạ sốt", "Tôi · thuốc giảm đau / hạ sốt · uống rồi"),
            _item("Tôi đang uống thuốc khác", "Tôi · thuốc khác · đang uống"),
        ]
    if any(w in msg_lower for w in ["khi nào", "bao lâu", "mấy ngày", "hôm nào", "bắt đầu", "thời gian"]):
        return [
            _item("Mới bị hôm nay", "Hôm nay · mới bị"),
            _item("Khoảng 2 ngày nay", "2 ngày · rồi"),
            _item("Khoảng 5 ngày nay", "5 ngày · rồi"),
            _item("Hơn 1 tuần rồi", "Hơn 1 tuần · rồi"),
        ]
    if any(w in msg_lower for w in ["mức độ", "nặng hay nhẹ", "nhiều không", "dữ dội", "nhiều hay ít"]):
        return [
            _item("Mức độ nhẹ / âm ỉ", "Đau · nhẹ / âm ỉ"),
            _item("Mức độ vừa", "Đau · vừa"),
            _item("Đau nặng / dữ dội", "Đau · nặng nhiều"),
        ]
    if any(w in msg_lower for w in ["bhyt", "cccd", "bảo hiểm", "giấy tờ", "sổ khám"]):
        return [
            _item("Tôi có mang thẻ BHYT / CCCD", "Tôi · thẻ BHYT / CCCD · mang có"),
            _item("Tôi quên mang thẻ BHYT", "Tôi · thẻ BHYT · quên mang"),
            _item("Tôi đăng ký khám không dùng BHYT", "Tôi · khám · BHYT không"),
        ]
    if any(w in msg_lower for w in ["sang phòng", "đến bàn", "ngồi chờ", "ra ghế", "lấy số"]):
        return [
            _item("Đã hiểu, tôi di chuyển ngay", "Tôi · hiểu rồi · đi ngay"),
            _item("Cần nhân viên chỉ đường giúp tôi", "Tôi · cần · chỉ đường giúp"),
        ]
    if any(w in msg_lower for w in ["vị trí", "ở đâu", "chỗ nào", "chổ nào", "bên trái", "bên phải"]):
        return [
            _item("Đau ở bên trái", "Bên trái · đau"),
            _item("Đau ở bên phải", "Bên phải · đau"),
            _item("Đau cả hai bên / ở giữa", "Hai bên / ở giữa · đau"),
        ]
    return []


def _clean_reply_items(items: List[object], limit: int = 4) -> List[Dict[str, str]]:
    result: List[Dict[str, str]] = []
    seen = set()
    for raw in items:
        if isinstance(raw, dict):
            text = str(raw.get("text") or "").strip()
            vsl_text = str(raw.get("vsl_text") or "").strip()
        else:
            text = str(raw or "").strip()
            vsl_text = ""

        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())
        result.append({
            "text": text,
            "vsl_text": vsl_text or _heuristic_to_vsl_order(text),
        })
        if len(result) >= limit:
            break
    return result


def suggest_patient_quick_reply_items(doctor_message: str) -> List[Dict[str, str]]:
    """
    Sinh 3–4 lựa chọn trả lời nhanh kèm 2 dạng chữ (Tiếng Việt chuẩn + trật tự VSL):
    - Tầng 1: Khớp mẫu chuẩn lâm sàng (<1ms offline).
    - Tầng 2: Nếu là câu hỏi tự do mới của nhân viên và có Gemini, gọi Gemini tạo cả `text` và `vsl_text`.
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
        return [dict(it) for it in _reply_cache[cache_key]]

    if gemini_client.is_configured():
        system_prompt = (
            "Bạn hỗ trợ thiết kế nút bấm trả lời nhanh cho bệnh nhân khiếm thính tại Kiosk bệnh viện (Zero-Typing).\n"
            "Nhiệm vụ: Đọc câu hỏi/hướng dẫn của nhân viên y tế và tạo đúng 3 nút trả lời ngắn gọn, mỗi nút gồm:\n"
            "1) `text`: Tiếng Việt chuẩn tự nhiên (<= 9 từ, ngôi 'Tôi ...').\n"
            "2) `vsl_text`: Viết lại chính ý đó theo trật tự ngữ pháp Ngôn ngữ ký hiệu Việt Nam (VSL) cho dễ đọc: "
            "đưa Chủ ngữ / Thời gian / Đối tượng lên trước, đưa Động từ / Trạng thái tiếp theo, và đưa Phủ định ('không', 'chưa') hoặc Từ xác nhận ('có', 'rồi') ra CUỐI; ngăn nhịp bằng dấu ' · '.\n"
            "Ví dụ:\n"
            "- 'Tôi chưa ăn sáng' -> vsl_text: 'Tôi · ăn sáng · chưa'\n"
            "- 'Tôi không bị sốt' -> vsl_text: 'Tôi · sốt · không'\n"
            "- 'Tôi đang rất căng thẳng' -> vsl_text: 'Tôi · căng thẳng nhiều · có'"
        )
        user_prompt = (
            f"Câu của nhân viên y tế gửi tới Kiosk:\n\"{msg}\"\n\n"
            "Hãy trả về JSON gồm 3 phần tử trong `quick_replies` (mỗi phần tử có `text` và `vsl_text`)."
        )
        data = gemini_client.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=PATIENT_REPLIES_SCHEMA,
            temperature=0.2,
            timeout=5.0,
        )
        if data and isinstance(data.get("quick_replies"), list):
            cleaned = _clean_reply_items(data["quick_replies"], limit=4)
            if cleaned:
                _reply_cache[cache_key] = cleaned
                if len(_reply_cache) > _CACHE_LIMIT:
                    _reply_cache.popitem(last=False)
                return [dict(it) for it in cleaned]

    # Fallback offline an toàn cho câu hỏi/chỉ dẫn bất kỳ
    is_question = "?" in msg or any(w in msg_lower.split() for w in ["không", "chưa", "gì", "nào", "đâu"])
    if is_question:
        return [
            _item("Có / Đúng vậy", "Có / Đúng"),
            _item("Không có", "Không"),
            _item("Tôi chưa rõ, cần hỗ trợ", "Tôi · hiểu chưa rõ · cần giúp"),
        ]
    return [
        _item("Đã hiểu, tôi thực hiện ngay", "Tôi · hiểu rồi · làm ngay"),
        _item("Cần nhân viên hỗ trợ thêm", "Tôi · cần · người giúp"),
    ]


def suggest_patient_quick_replies(doctor_message: str) -> List[str]:
    """Giữ tương thích ngược: trả về danh sách chuỗi tiếng Việt chuẩn."""
    return [item["text"] for item in suggest_patient_quick_reply_items(doctor_message)]
