"""
vsl_text_helper.py
------------------
Chuẩn hóa chuỗi Gloss VSL thành dạng chữ dễ đọc cho người khiếm thính trên UI Kiosk:
- Giữ nguyên trật tự ngữ pháp VSL (Chủ ngữ → Vị trí/Triệu chứng → Phủ định/Từ hỏi ở cuối).
- Bỏ gạch nối kỹ thuật và chữ IN HOA cứng nhắc (trừ từ viết tắt y tế như BHYT, CCCD, BMI).
- Ngăn cách các nhịp ký hiệu bằng dấu `·` để người thăm khám liếc mắt nắm đúng trọng tâm.
"""

import re
from typing import Dict, List, Optional, Set

SKIP_GLOSS_TOKENS: Set[str] = {
    "<blank>",
    "<unk>",
    "<pad>",
    "<bos>",
    "<eos>",
    "IX",
}

UPPER_ACRONYMS: Set[str] = {
    "BHYT",
    "CCCD",
    "BMI",
    "CT",
    "MRI",
    "ECG",
    "HIV",
}

GLOSS_READABLE_OVERRIDES: Dict[str, str] = {
    "CÓ-KHÔNG": "có không?",
    "CÓ-CHƯA": "có chưa?",
    "PHẢI-KHÔNG": "phải không?",
    "ĐÚNG-KHÔNG": "đúng không?",
    "CẦN-KHÔNG": "cần không?",
    "ĐƯỢC-KHÔNG": "được không?",
    "ĐAU-KHÔNG": "đau không?",
    "SAO-KHÔNG": "sao không?",
    "BAO-LÂU": "bao lâu?",
    "KHI-NÀO": "khi nào?",
    "BAO-GIỜ": "bao giờ?",
    "Ở-ĐÂU": "ở đâu?",
    "BAO-NHIÊU": "bao nhiêu?",
    "BỆNH-GÌ": "bệnh gì?",
    "TẠI-SAO": "tại sao?",
    "GÌ": "gì?",
    "ĐÂU": "đâu?",
    "BẢO-HIỂM": "bảo hiểm",
    "Y-TẾ": "y tế",
    "KHÔNG-CÓ": "không có",
    "KHÔNG-CẦN": "không cần",
    "KHÔNG-ĐƯỢC": "không được",
    "KHÔNG-NHẬN": "không nhận",
}


def format_gloss_token(token: str) -> str:
    """Chuyển một mã gloss (vd `BỤNG-ĐAU`) thành cụm từ tiếng Việt dễ đọc (`bụng đau`)."""
    raw = (token or "").strip()
    if not raw or raw in SKIP_GLOSS_TOKENS or raw.upper() in SKIP_GLOSS_TOKENS:
        return ""

    upper = raw.upper()
    if upper in GLOSS_READABLE_OVERRIDES:
        return GLOSS_READABLE_OVERRIDES[upper]

    parts = [p.strip() for p in re.split(r"[-_]+", raw) if p.strip()]
    if not parts:
        return ""

    normalized_parts: List[str] = []
    for p in parts:
        p_up = p.upper()
        if p_up in UPPER_ACRONYMS:
            normalized_parts.append(p_up)
        else:
            normalized_parts.append(p.lower())
    return " ".join(normalized_parts)


def format_vsl_chunks(
    glosses: Optional[List[str]],
    missing_terms: Optional[List[str]] = None,
) -> List[str]:
    """
    Chuyển danh sách gloss thành các cụm chữ theo đúng trật tự VSL.
    Viết hoa chữ cái đầu tiên của cụm mở đầu cho tự nhiên khi đọc.
    """
    chunks: List[str] = []
    for g in glosses or []:
        readable = format_gloss_token(g)
        if not readable:
            continue
        if chunks and chunks[-1].lower() == readable.lower():
            continue
        chunks.append(readable)

    joined_lower = " ".join(c.lower() for c in chunks)
    for term in missing_terms or []:
        t = (term or "").strip()
        if not t:
            continue
        if t.lower() not in joined_lower:
            chunks.append(t)

    if chunks:
        first = chunks[0]
        chunks[0] = first[0].upper() + first[1:]

    return chunks


def format_vsl_sentence(
    glosses: Optional[List[str]],
    missing_terms: Optional[List[str]] = None,
) -> Optional[str]:
    """Tạo chuỗi câu đọc theo ngữ pháp VSL thân thiện (vd: `Tôi · bụng đau · hôm nay`)."""
    chunks = format_vsl_chunks(glosses, missing_terms=missing_terms)
    if not chunks:
        return None
    return " · ".join(chunks)

