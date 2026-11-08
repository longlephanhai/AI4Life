"""
semantic_parser.py
------------------
Bộ phân tích ngữ nghĩa y tế dựa trên quy tắc (Rule-based Semantic Parser)
Chuyển đổi chuỗi Gloss hoặc câu dịch tự do thành SemanticFrame chuẩn mực y tế.
Tuân thủ chặt chẽ tiêu chuẩn an toàn trong PRD — SignBridge AI.
"""

from typing import List, Optional, Set
from schemas import SemanticFrame, IntentType

# --- 1. TỪ ĐIỂN QUY TẮC (LEXICAL ONTOLOGY) ---

EMERGENCY_KEYWORDS: Set[str] = {
    "KHÓ-THỞ", "THỞ-KHÓ", "NGỰC-ĐAU", "ĐAU-NGỰC", "BẤT-TỈNH", 
    "CHẢY-MÁU", "CẤP-CỨU", "TIM-ĐẬP-NHANH", "CO-GIẬT"
}

SYMPTOM_MAP = {
    "ĐAU-BỤNG": ("Đau bụng", "bụng"),
    "ĐẦU-ĐAU": ("Đau đầu", "đầu"),
    "ĐAU-ĐẦU": ("Đau đầu", "đầu"),
    "SỐT": ("Sốt", None),
    "HO": ("Ho", "đường hô hấp"),
    "NÔN": ("Buồn nôn / Nôn", "tiêu hóa"),
    "CHÓNG-MẶT": ("Chóng mặt", "thần kinh"),
    "MỆT": ("Mệt mỏi suy nhược", None),
    "ĐAU-HỌNG": ("Đau họng", "họng"),
    "TIÊU-CHẢY": ("Tiêu chảy", "tiêu hóa"),
    "ĐAU": ("Đau nhức (chưa rõ vị trí)", None),
}

LOCATION_KEYWORDS = {
    "BỤNG": "vùng bụng",
    "ĐẦU": "vùng đầu",
    "NGỰC": "vùng ngực",
    "HỌNG": "vùng cổ họng",
    "LƯNG": "vùng lưng",
    "RĂNG": "vùng hàm mặt/răng",
}

ONSET_MAP = {
    "HÔM-QUA": "hôm qua (~24 giờ trước)",
    "HÔM-NAY": "hôm nay (trong ngày)",
    "SÁNG-NAY": "sáng nay",
    "GẦN-ĐÂY": "gần đây (vài ngày gần đây)",
    "MẤY-NGÀY": "vài ngày trước",
    "TUẦN-TRƯỚC": "khoảng 1 tuần trước",
}

SEVERITY_MAP = {
    "NHIỀU": "Nhiều / Nặng",
    "NẶNG": "Nặng / Dữ dội",
    "DỮ-DỘI": "Dữ dội / Rất nặng",
    "NHẸ": "Nhẹ / Âm ỉ",
    "ÍT": "Ít / Mức độ nhẹ",
}

INQUIRY_KEYWORDS: Set[str] = {
    "HẸN", "TRƯỚC", "CHƯA", "CHỜ", "LÂU", "BAO-LÂU", 
    "KHI-NÀO", "Ở-ĐÂU", "BAO-NHIÊU", "BAO-GIỜ"
}

REGISTRATION_KEYWORDS: Set[str] = {
    "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "BÁC-SĨ", "SỔ-KHÁM", "ĐỊNH-KỲ"
}


def normalize_tokens(tokens: Optional[List[str]], text: Optional[str]) -> List[str]:
    """Chuẩn hóa danh sách token từ gloss hoặc text."""
    result = []
    if tokens:
        for t in tokens:
            result.append(t.upper().strip())
    if text:
        # Tách từ tiếng Việt viết hoa để hỗ trợ quét thêm
        clean_text = text.upper().replace(",", " ").replace(".", " ").replace("?", " ")
        for word in clean_text.split():
            result.append(word)
    return result


def parse_semantic_frame(
    gloss_sequence: Optional[List[str]] = None,
    translation: Optional[str] = None
) -> SemanticFrame:
    """
    Phân tích chuỗi Gloss hoặc câu dịch tiếng Việt thành SemanticFrame.
    """
    tokens = normalize_tokens(gloss_sequence, translation)
    translation_str = translation or " ".join(gloss_sequence or [])

    # 1. Phát hiện dấu hiệu CẤP CỨU (EMERGENCY)
    for t in tokens:
        if t in EMERGENCY_KEYWORDS or any(kw in translation_str.upper() for kw in EMERGENCY_KEYWORDS):
            return SemanticFrame(
                intent=IntentType.EMERGENCY,
                visit_reason="CẤP CỨU: Xuất hiện triệu chứng nguy hiểm",
                symptoms=["Khó thở / Đau ngực cấp / Nguy cơ nguy kịch"],
                severity="Nghiêm trọng / Cần xử trí ngay",
                needs_human_review=True,
                review_reasons=["PHÁT HIỆN DẤU HIỆU CẤP CỨU: Yêu cầu điều dưỡng kiểm tra sinh hiệu ngay lập tức!"],
                summary_for_clinician="⚠️ [CẢNH BÁO ĐỎ] Người bệnh có dấu hiệu khó thở / tức ngực cấp. Cần hỗ trợ khẩn cấp!",
                patient_confirmation_text=f"Có phải bạn đang thấy: '{translation_str}' rất khó chịu không? Chúng tôi đang gọi y tá hỗ trợ bạn ngay!",
                suggested_action="Chuyển ngay sang luồng CẤP CỨU / Kích hoạt chuông gọi điều dưỡng trực tiếp."
            )

    # 2. Phát hiện TRIỆU CHỨNG BỆNH (SYMPTOM_REPORT)
    detected_symptoms = []
    detected_locations = []
    for t in tokens:
        for sym_key, (sym_name, sym_loc) in SYMPTOM_MAP.items():
            if sym_key in t or sym_key in translation_str.upper():
                if sym_name not in detected_symptoms:
                    detected_symptoms.append(sym_name)
                if sym_loc and sym_loc not in detected_locations:
                    detected_locations.append(sym_loc)

    for loc_key, loc_val in LOCATION_KEYWORDS.items():
        if loc_key in tokens or loc_key in translation_str.upper():
            if loc_val not in detected_locations:
                detected_locations.append(loc_val)

    # 3. Phát hiện THỜI GIAN KHỞI PHÁT (ONSET) & MỨC ĐỘ (SEVERITY)
    detected_onset = None
    for onset_key, onset_val in ONSET_MAP.items():
        if onset_key in tokens or onset_key in translation_str.upper():
            detected_onset = onset_val
            break

    detected_severity = None
    for sev_key, sev_val in SEVERITY_MAP.items():
        if sev_key in tokens or sev_key in translation_str.upper():
            detected_severity = sev_val
            break

    # 4. Phát hiện CÂU HỎI THÔNG TIN (INQUIRY)
    is_inquiry = any(t in INQUIRY_KEYWORDS for t in tokens) or ("chờ" in translation_str.lower() or "hẹn" in translation_str.lower() or "bao lâu" in translation_str.lower())

    # 5. Phát hiện ĐĂNG KÝ KHÁM (REGISTRATION)
    is_registration = any(t in REGISTRATION_KEYWORDS for t in tokens) or ("đăng ký" in translation_str.lower() or "khám sức khỏe" in translation_str.lower())

    # --- TỔNG HỢP SEMANTIC FRAME THEO PHÂN LOẠI ---

    review_reasons = []
    needs_review = False

    # Trường hợp A: Báo triệu chứng
    if detected_symptoms:
        intent = IntentType.SYMPTOM_REPORT
        visit_reason = f"Khám triệu chứng: {', '.join(detected_symptoms)}"
        
        # Kiểm tra an toàn y tế (Safety Check)
        if not detected_onset:
            needs_review = True
            review_reasons.append("Chưa rõ thời điểm khởi phát triệu chứng (Onset unknown)")
        if not detected_severity:
            review_reasons.append("Chưa rõ mức độ đau/khó chịu (Severity unknown)")
        
        # Tiền sử dị ứng mặc định chưa xác nhận
        needs_review = True
        review_reasons.append("Tiền sử dị ứng thuốc: Chưa xác nhận (Cần nhân viên hỏi lại)")

        summary = (
            f"Triệu chứng: {', '.join(detected_symptoms)} | "
            f"Vị trí: {', '.join(detected_locations) if detected_locations else 'Chưa định vị cụ thể'} | "
            f"Khởi phát: {detected_onset or 'Chưa rõ'} | "
            f"Mức độ: {detected_severity or 'Chưa rõ'}"
        )
        action = "Chuyển thông tin vào hồ sơ khám. Nhân viên kiểm tra tiền sử dị ứng và đo sinh hiệu."

    # Trường hợp B: Hỏi đáp thời gian chờ
    elif is_inquiry:
        intent = IntentType.INQUIRY
        visit_reason = "Hỏi thông tin thời gian chờ / thủ tục hẹn trước"
        summary = "Người bệnh muốn hỏi về thời gian chờ khám / kiểm tra số thứ tự hẹn trước."
        action = "Hệ thống tự động hiển thị thời gian chờ dự kiến (khoảng 10-15 phút) trên màn hình."

    # Trường hợp C: Đăng ký khám sức khỏe
    elif is_registration:
        intent = IntentType.REGISTRATION
        visit_reason = "Đăng ký khám sức khỏe định kỳ"
        summary = "Đăng ký khám sức khỏe tổng quát ban đầu (Không có triệu chứng bệnh cấp tính)."
        action = "Xuất phiếu số thứ tự phòng khám đa khoa tổng quát."

    # Trường hợp D: Giao tiếp thông thường
    else:
        intent = IntentType.GENERAL
        visit_reason = "Giao tiếp tiếp đón chung"
        summary = f"Câu dịch người bệnh: '{translation_str}'"
        action = "Nhân viên tiếp nhận hỗ trợ hướng dẫn người bệnh."

    return SemanticFrame(
        intent=intent,
        visit_reason=visit_reason,
        symptoms=detected_symptoms,
        body_location=", ".join(detected_locations) if detected_locations else None,
        onset=detected_onset,
        severity=detected_severity,
        allergy_status="not_confirmed",
        medication_status="unknown",
        needs_human_review=needs_review,
        review_reasons=review_reasons,
        summary_for_clinician=summary,
        patient_confirmation_text=f"Ý của bạn là: '{translation_str}' — Có đúng không?",
        suggested_action=action
    )


# --- KIỂM THỬ NHANH ĐỘC LẬP (UNIT TEST) ---
if __name__ == "__main__":
    print("=== TEST CASE 1: Đăng ký khám sức khỏe ===")
    f1 = parse_semantic_frame(
        gloss_sequence=["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"],
        translation="Tôi muốn đăng ký khám sức khỏe."
    )
    print("Intent:", f1.intent)
    print("Tóm tắt bác sĩ:", f1.summary_for_clinician)
    print("Hành động:", f1.suggested_action)

    print("\n=== TEST CASE 2: Hỏi thời gian chờ ===")
    f2 = parse_semantic_frame(
        gloss_sequence=["TÔI", "HẸN", "TRƯỚC", "CHƯA"],
        translation="Tôi có phải chờ lâu không?"
    )
    print("Intent:", f2.intent)
    print("Tóm tắt bác sĩ:", f2.summary_for_clinician)
    print("Hành động:", f2.suggested_action)

    print("\n=== TEST CASE 3: Báo triệu chứng đau bụng ===")
    f3 = parse_semantic_frame(
        gloss_sequence=["TÔI", "ĐAU-BỤNG", "HÔM-QUA", "NHIỀU"],
        translation="Tôi bị đau bụng nhiều từ hôm qua."
    )
    print("Intent:", f3.intent)
    print("Triệu chứng:", f3.symptoms)
    print("Khởi phát:", f3.onset)
    print("Mức độ:", f3.severity)
    print("Cần nhân viên hỏi lại:", f3.needs_human_review)
    print("Lý do:", f3.review_reasons)

    print("\n=== TEST CASE 4: Cảnh báo cấp cứu ===")
    f4 = parse_semantic_frame(
        gloss_sequence=["TÔI", "NGỰC-ĐAU", "KHÓ-THỞ"],
        translation="Tôi bị đau ngực và rất khó thở."
    )
    print("Intent:", f4.intent)
    print("Cảnh báo:", f4.review_reasons)

