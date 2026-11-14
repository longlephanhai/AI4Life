"""
semantic_parser.py (Phiên bản 3.0 — Kho tri thức phân luồng chuẩn hóa)
-----------------------------------------------------------------------
Bộ phân tích ngữ nghĩa y tế kết nối trực tiếp với Kho tri thức `backend/data/triage_kb.json`
qua `triage_kb.py`:
- Bao phủ 7 nhóm nghiệp vụ + Cấp cứu đỏ.
- Phân khoa chính xác theo từng nhóm triệu chứng (Tiêu hóa / Hô hấp / Thần kinh / Giấc ngủ...).
- Kiểm tra cạnh `red_flags` (từ triệu chứng thường chuyển cấp cứu nếu có dấu hiệu nặng).
- Hỗ trợ gom ngữ cảnh hội thoại đa lượt (`dialogue_history`) để tự điền slot
  (vị trí, thời gian, mức độ, dị ứng) và chỉ gợi ý câu hỏi còn thiếu.
"""

from typing import Any, Dict, List, Optional, Set
from schemas import SemanticFrame, IntentType
from triage_kb import triage_kb

# Giữ tương thích ngược nếu module khác cần tham chiếu hằng số từ điển
EMERGENCY_WORDS: Set[str] = {
    "KHÓ-THỞ", "THỞ-KHÓ", "NGỰC-ĐAU", "ĐAU-NGỰC", "BẤT-TỈNH",
    "CHẢY-MÁU", "CẤP-CỨU", "TIM-ĐẬP-NHANH", "CO-GIẬT", "NÔN-MÁU"
}

GENERAL_SYMPTOMS_MAP = {
    "ĐAU-ĐẦU": "Đau đầu / Nhức đầu",
    "ĐẦU-ĐAU": "Đau đầu / Nhức đầu",
    "ĐAU-BỤNG": "Đau bụng / Rối loạn tiêu hóa",
    "BỤNG-ĐAU": "Đau bụng / Rối loạn tiêu hóa",
    "SỐT": "Ho / Sốt (Triệu chứng hô hấp)",
    "HO": "Ho / Sốt (Triệu chứng hô hấp)",
    "KHAN-HO": "Ho / Sốt (Triệu chứng hô hấp)",
    "CHÓNG-MẶT": "Đau đầu / Chóng mặt / Mệt mỏi",
    "CHẢY-MÁU": "Chảy máu",
    "NÔN": "Đau bụng / Rối loạn tiêu hóa",
    "MỆT": "Đau đầu / Chóng mặt / Mệt mỏi",
    "TIÊU-CHẢY": "Đau bụng / Rối loạn tiêu hóa",
    "MẤT-NGỦ": "Mất ngủ / Rối loạn giấc ngủ hoặc chuyển hóa",
    "BÉO-PHÌ": "Mất ngủ / Rối loạn giấc ngủ hoặc chuyển hóa",
    "ĐAU": "Đau nhức cơ thể",
}

ONSET_MAP = {
    "HÔM-QUA": "hôm qua (~24h trước)",
    "HÔM-NAY": "hôm nay (trong ngày)",
    "SÁNG-NAY": "sáng nay",
    "GẦN-ĐÂY": "vài ngày gần đây",
    "1-NGÀY": "khoảng 1 ngày trước",
    "3-NGÀY": "khoảng 3 ngày trước",
    "TUẦN-TRƯỚC": "khoảng 1 tuần trước",
    "LẦN-ĐẦU": "lần đầu tiên xuất hiện",
}

SEVERITY_MAP = {
    "NHIỀU": "Nhiều / Nặng",
    "NẶNG": "Nặng / Nhiều",
    "NGỨA-NHIỀU": "Ngứa nhiều, khó chịu",
    "DỮ-DỘI": "Dữ dội / Rất nặng",
    "ÍT": "Nhẹ / Ít",
    "NHẸ": "Nhẹ / Ít",
    "BÌNH-THƯỜNG": "Mức độ vừa phải",
}


def parse_semantic_frame(
    gloss_sequence: Optional[List[str]] = None,
    translation: Optional[str] = None,
    dialogue_history: Optional[List[Dict[str, Any]]] = None,
) -> SemanticFrame:
    """
    Phân tích chuỗi Gloss / câu dịch tiếng Việt (và lịch sử hội thoại đa lượt nếu có)
    dựa trên Kho tri thức `triage_kb.json`.
    """
    latest_raw, combined_upper, combined_tokens = triage_kb.collect_patient_context(
        gloss_sequence=gloss_sequence,
        translation=translation,
        dialogue_history=dialogue_history,
    )
    slots = triage_kb.extract_slots(combined_upper, combined_tokens)
    matched_nodes = triage_kb.retrieve_nodes(combined_upper, combined_tokens, top_k=4)

    # 1. Kiểm tra dấu hiệu cấp cứu toàn cục và cạnh red_flags của triệu chứng khớp được
    emergency_hit = triage_kb.check_emergency(matched_nodes, combined_upper, combined_tokens)
    if emergency_hit:
        return SemanticFrame(
            intent=IntentType.EMERGENCY,
            specialty=emergency_hit["specialty"],
            visit_reason="CẤP CỨU: Phát hiện dấu hiệu nguy hiểm",
            symptoms=["Khó thở / Đau ngực cấp / Chảy máu nhiều / Nguy cơ suy hô hấp"],
            body_location=slots["body_location"],
            onset=slots["onset"],
            severity="Nghiêm trọng (Nguy kịch)",
            allergy_status=slots["allergy_status"] or "not_confirmed",
            medication_status=slots["medication_status"] or "unknown",
            needs_human_review=True,
            review_reasons=[f"PHÁT HIỆN CỜ ĐỎ: {emergency_hit['alert']}"],
            summary_for_clinician=f"⚠️ [CẢNH BÁO ĐỎ] {emergency_hit['alert']} (Nội dung: '{latest_raw}')",
            patient_confirmation_text=f"Có phải bạn đang thấy: '{latest_raw}' rất khó chịu không? Đội ngũ y tế đang đến hỗ trợ bạn ngay!",
            suggested_action=emergency_hit["suggested_action"],
            doctor_quick_responses=emergency_hit["responses"],
        )

    # 2. Chọn node chính từ kết quả truy xuất KB
    if not matched_nodes:
        reg = triage_kb.get_default_registration_node()
        return SemanticFrame(
            intent=IntentType.REGISTRATION,
            specialty=reg["specialty"],
            visit_reason=f"Thủ tục hành chính tiếp nhận: {latest_raw}",
            symptoms=[],
            body_location=slots["body_location"],
            onset=slots["onset"],
            severity=slots["severity"],
            allergy_status=slots["allergy_status"] or "not_confirmed",
            medication_status=slots["medication_status"] or "unknown",
            needs_human_review=False,
            review_reasons=[],
            summary_for_clinician=f"Người bệnh khai báo thông tin hành chính: '{latest_raw}'.",
            patient_confirmation_text=f"Ý của bạn là: '{latest_raw}' — Có đúng không?",
            suggested_action=reg["suggested_action"],
            doctor_quick_responses=reg["default_responses"],
        )

    primary = matched_nodes[0]
    intent = IntentType(primary["intent"])
    specialty = primary["specialty"]

    # 3. Các nhóm tác vụ không phải triệu chứng bệnh lý (Hợp tác khám / Cận lâm sàng / Hỏi đáp / Đăng ký)
    if intent in {
        IntentType.EXAM_COOPERATION,
        IntentType.LAB_DIAGNOSTIC,
        IntentType.INQUIRY,
        IntentType.REGISTRATION,
    }:
        visit_reason_prefix = {
            IntentType.EXAM_COOPERATION: f"Hợp tác thao tác: {primary['title']}",
            IntentType.LAB_DIAGNOSTIC: f"Thực hiện cận lâm sàng: {primary['title']}",
            IntentType.INQUIRY: primary["title"],
            IntentType.REGISTRATION: f"Thủ tục hành chính: {latest_raw}",
        }[intent]

        summary_map = {
            IntentType.EXAM_COOPERATION: f"Người bệnh đang hỏi để phối hợp thao tác: '{latest_raw}'. Bác sĩ chọn hướng dẫn phản hồi.",
            IntentType.LAB_DIAGNOSTIC: f"Người bệnh có chỉ định {primary['title']}. Cần hướng dẫn di chuyển sang {specialty}.",
            IntentType.INQUIRY: f"Người bệnh hỏi thông tin: '{latest_raw}'. Nhân viên chọn câu trả lời nhanh bên dưới.",
            IntentType.REGISTRATION: f"Người bệnh khai báo thông tin hành chính: '{latest_raw}'.",
        }

        return SemanticFrame(
            intent=intent,
            specialty=specialty,
            visit_reason=visit_reason_prefix,
            symptoms=[],
            body_location=slots["body_location"],
            onset=slots["onset"],
            severity=slots["severity"],
            allergy_status=slots["allergy_status"] or "not_confirmed",
            medication_status=slots["medication_status"] or "unknown",
            needs_human_review=False,
            review_reasons=[],
            summary_for_clinician=summary_map[intent],
            patient_confirmation_text=f"Ý của bạn là: '{latest_raw}' — Có đúng không?",
            suggested_action=primary["suggested_action"],
            doctor_quick_responses=primary.get("default_responses", []),
        )

    # 4. Nhóm triệu chứng bệnh lý / chuyên khoa: tổng hợp triệu chứng và gợi ý câu hỏi theo slot còn thiếu
    specific_nodes = [
        n for n in matched_nodes
        if n.get("intent") in {"symptom_report", "specialty_ent_dental", "specialty_other"}
        and n.get("id") != "sym_general_pain"
    ]
    active_symptom_nodes = specific_nodes or [primary]

    aggregated_symptoms: List[str] = []
    for node in active_symptom_nodes:
        for sym in node.get("symptoms", []):
            if sym not in aggregated_symptoms:
                aggregated_symptoms.append(sym)
    if not aggregated_symptoms:
        aggregated_symptoms = [primary["title"]]

    review_reasons, smart_follow_ups = triage_kb.build_follow_up_questions(
        active_symptom_nodes,
        slots,
        max_questions=3,
    )

    summary_parts = [f"Triệu chứng: {', '.join(aggregated_symptoms)}"]
    if slots["body_location"]:
        summary_parts.append(f"Vị trí: {slots['body_location']}")
    summary_parts.append(f"Khởi phát: {slots['onset'] or 'Chưa rõ'}")
    summary_parts.append(f"Mức độ: {slots['severity'] or 'Chưa rõ'}")
    if slots["allergy_status"] != "not_confirmed":
        allergy_vi = "Không dị ứng" if slots["allergy_status"] == "confirmed_none" else "Có tiền sử dị ứng"
        summary_parts.append(f"Dị ứng: {allergy_vi}")

    return SemanticFrame(
        intent=intent,
        specialty=specialty,
        visit_reason=f"Khám {specialty}: {', '.join(aggregated_symptoms)}",
        symptoms=aggregated_symptoms,
        body_location=slots["body_location"],
        onset=slots["onset"],
        severity=slots["severity"],
        allergy_status=slots["allergy_status"] or "not_confirmed",
        medication_status=slots["medication_status"] or "unknown",
        needs_human_review=bool(review_reasons) or primary.get("allergy_required", False),
        review_reasons=review_reasons,
        summary_for_clinician=" | ".join(summary_parts),
        patient_confirmation_text=f"Ý của bạn là: '{latest_raw}' — Có đúng không?",
        suggested_action=primary["suggested_action"],
        doctor_quick_responses=smart_follow_ups or primary.get("default_responses", []),
    )


if __name__ == "__main__":
    test_cases = [
        ("SENT001", ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"], "Tôi muốn đăng ký khám sức khỏe"),
        ("SENT222", ["TÔI", "MIỆNG-HÁ", "PHẢI-KHÔNG"], "Tôi há miệng ra phải không?"),
        ("SENT081", ["TÔI", "ÁO-KHOÁC", "CỞI", "CẦN-KHÔNG"], "Tôi có cần cởi áo khoác không?"),
        ("SENT240", ["TÔI", "SIÊU-ÂM", "TIM"], "Tôi được chỉ định siêu âm tim"),
        ("SENT113", ["TÔI", "RĂNG", "SÂU"], "Tôi bị sâu răng"),
        ("SENT141", ["TÔI", "CẬN-THỊ"], "Tôi bị cận thị"),
        ("SENT121", ["TÔI", "KHỚP-GỐI", "ĐAU"], "Tôi bị đau khớp gối"),
        ("SENT027", ["TÔI", "CHỜ", "LÂU", "PHẢI-KHÔNG"], "Tôi có phải chờ lâu không?"),
        ("SENT_GI", ["TÔI", "ĐAU-BỤNG"], "Tôi bị đau bụng"),
        ("SENT_SLEEP", ["TÔI", "MẤT-NGỦ"], "Tôi bị mất ngủ"),
        ("SENT_EMG", ["TÔI", "NGỰC-ĐAU", "KHÓ-THỞ"], "Tôi bị tức ngực và rất khó thở"),
    ]

    print("================== KẾT QUẢ KIỂM THỬ TRIAGE KB ==================\n")
    for sid, glosses, text in test_cases:
        res = parse_semantic_frame(gloss_sequence=glosses, translation=text)
        print(f"[{sid}] Câu: '{text}'")
        print(f"  -> Intent: {res.intent.value} | Chuyên khoa: {res.specialty}")
        print(f"  -> Tóm tắt: {res.summary_for_clinician}")
        print(f"  -> Gợi ý hỏi tiếp: {res.doctor_quick_responses}")
        print("-" * 75)
