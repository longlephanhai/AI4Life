"""
semantic_parser.py (Phiên bản 2.0 Toàn diện)
--------------------------------------------
Bộ phân tích ngữ nghĩa y tế dựa trên quy tắc (Rule-based Clinical Ontology Parser)
Bao phủ toàn diện 7 nhóm nghiệp vụ trong bộ dữ liệu 300 câu VSL-GH:
1. Tiếp nhận & Hành chính
2. Triệu chứng toàn thân & Cấp cứu
3. Răng - Hàm - Mặt & Tai - Mũi - Họng
4. Mắt, Da liễu & Cơ - Xương - Khớp
5. Cận lâm sàng & Xét nghiệm
6. Hợp tác khám lâm sàng (Há miệng, cởi áo, tháo kính...)
7. Hỏi đáp thông tin & Lịch hẹn
"""

from typing import List, Optional, Set, Tuple
from schemas import SemanticFrame, IntentType

# --- 1. TỪ ĐIỂN QUY TẮC CHUYÊN SÂU ---

EMERGENCY_WORDS: Set[str] = {
    "KHÓ-THỞ", "THỞ-KHÓ", "NGỰC-ĐAU", "ĐAU-NGỰC", "BẤT-TỈNH", 
    "CHẢY-MÁU", "CẤP-CỨU", "TIM-ĐẬP-NHANH", "CO-GIẬT", "NÔN-MÁU"
}

# Nhóm 6: Hợp tác khám lâm sàng
EXAM_COOPERATION_MAP = [
    (["MIỆNG-HÁ", "HÁ MIỆNG", "HÁ-MIỆNG", "MỞ MIỆNG"], 
     "Hợp tác khám: Há miệng kiểm tra vòm họng / răng miệng",
     "Đúng, mời bạn há to miệng để bác sĩ kiểm tra.",
     ["Đúng, mời bạn há miệng ra", "Chưa cần, ngậm miệng lại", "Nói 'A' to lên"]),
    
    (["ÁO-KHOÁC", "CỞI-ÁO", "CỞI ÁO", "CỞI-ÁO-KHOÁC"], 
     "Hợp tác khám: Cởi áo khoác ngoài để thăm khám / đo điện tim",
     "Đúng, bạn hãy cởi áo khoác ngoài ra nhé.",
     ["Đúng, hãy cởi áo khoác ngoài", "Không cần cởi áo", "Mời vén áo lên"]),
    
    (["KÍNH", "BỎ-KÍNH", "THÁO-KÍNH", "BỎ KÍNH", "THÁO KÍNH"], 
     "Hợp tác khám: Bỏ kính mắt để kiểm tra thị lực / chụp phim",
     "Đúng, bạn hãy tháo kính mắt ra và để vào khay.",
     ["Đúng, hãy tháo kính ra", "Đeo kính vào để kiểm tra", "Nhìn thẳng vào bảng chữ"]),
    
    (["KIM-LOẠI", "ĐỒ KIM LOẠI", "TRANG SỨC"], 
     "Hợp tác khám: Tháo bỏ trang sức / đồ kim loại trước khi chụp phim / chụp chiếu",
     "Cần tháo hết đồ kim loại (dây chuyền, nhẫn, đồng hồ) để chụp chiếu.",
     ["Đúng, hãy tháo hết đồ kim loại", "Không có đồ kim loại, mời vào"]),
    
    (["HÍT-THỞ", "THỞ-SÂU", "NÍN-THỞ", "HÍT SÂU", "NÍN THỞ"], 
     "Hợp tác khám: Thao tác nhịp thở theo hiệu lệnh của bác sĩ",
     "Bác sĩ đang hướng dẫn nhịp thở (hít sâu, nín thở).",
     ["Hít sâu vào... nín thở", "Thở đều bình thường ra"]),
    
    (["NẰM", "NGỒI", "NẰM XUỐNG", "NGỒI XUỐNG", "CỞI GIÀY"], 
     "Hợp tác khám: Thay đổi tư thế khám (nằm / ngồi / cởi giày)",
     "Mời bạn thực hiện tư thế khám theo yêu cầu.",
     ["Mời bạn nằm lên giường khám", "Mời bạn ngồi thẳng lưng", "Mời cởi giày ra"])
]

# Nhóm 5: Chỉ định cận lâm sàng & Xét nghiệm
LAB_DIAGNOSTIC_MAP = [
    (["SIÊU-ÂM TIM", "SIÊU ÂM TIM"], "Siêu âm tim màu", "Khoa Thăm dò chức năng (Phòng Siêu âm tim)",
     ["Mời sang Phòng Siêu âm Tim (P.204)", "Mời ngồi chờ gọi tên vào siêu âm"]),
    (["SIÊU-ÂM BỤNG", "SIÊU ÂM BỤNG", "SIÊU-ÂM", "SIÊU ÂM"], "Siêu âm ổ bụng tổng quát", "Khoa Chẩn đoán hình ảnh (Phòng Siêu âm)",
     ["Mời sang Phòng Siêu âm (P.201)", "Bạn đã nhịn tiểu / nhịn ăn chưa?"]),
    (["X-QUANG", "XQUANG", "CHỤP PHIM", "CHỤP PHỔI"], "Chụp X-quang kỹ thuật số", "Khoa Chẩn đoán hình ảnh (Phòng Chụp X-quang)",
     ["Mời sang Phòng Chụp X-quang (P.105)", "Tháo đồ kim loại trước khi vào"]),
    (["XÉT-NGHIỆM", "THỬ MÁU", "LẤY MÁU", "NƯỚC TIỂU"], "Xét nghiệm huyết học / Sinh hóa máu", "Khoa Xét nghiệm",
     ["Mời sang Phòng Lấy Máu (P.102)", "Kết quả xét nghiệm sau 45 phút"]),
    (["HUYẾT-ÁP", "ĐO HUYẾT ÁP", "CÂN-NẶNG", "CHIỀU-CAO", "BMI"], "Đo chỉ số sinh hiệu (Huyết áp, Chiều cao, Cân nặng)", "Bàn Tiếp đón / Đo sinh hiệu",
     ["Mời bạn xắn tay áo để đo huyết áp", "Chỉ số huyết áp của bạn bình thường"])
]

# Nhóm 3: Răng Hàm Mặt & Tai Mũi Họng
ENT_DENTAL_MAP = [
    (["RĂNG", "ĐAU-RĂNG", "SÂU-RĂNG", "CHÂN-RĂNG", "NHỔ-RĂNG", "CẠO-RĂNG", "CẠO VÔI"],
     "Vấn đề Răng - Hàm - Mặt", "Khoa Răng - Hàm - Mặt (Nha khoa)",
     ["Mời bạn lên ghế nha khoa", "Bác sĩ kiểm tra răng cho bạn nhé", "Chưa cần nhổ, bác sĩ sẽ trám"]),
    (["AMIDAN", "XOANG", "VIÊM-XOANG", "TAI", "TAI-Ù", "Ù TAI", "HỌNG", "ĐAU-HỌNG", "MŨI-NGHẸT", "NGHẸT MŨI", "SỔ MŨI"],
     "Bệnh lý Tai - Mũi - Họng", "Khoa Tai - Mũi - Họng",
     ["Mời bạn vào ghế soi tai mũi họng", "Bác sĩ kiểm tra vòm họng nhé"])
]

# Nhóm 4: Mắt, Da liễu, Cơ xương khớp
OTHER_SPECIALTY_MAP = [
    (["CẬN-THỊ", "CẬN THỊ", "MẮT", "MẮT-TRÁI", "ĐAU MẮT", "ĐEO-KÍNH"],
     "Bệnh lý về mắt / Khúc xạ", "Khoa Mắt (Nhãn khoa)",
     ["Mời bạn vào máy đo khúc xạ", "Mời bạn đọc bảng chữ cái trên tường"]),
    (["NGỨA", "NGỨA-NHIỀU", "DA", "NẤM-DA", "NẤM DA", "DỊ-ỨNG", "PHÁT BAN"],
     "Bệnh lý ngoài da / Da liễu", "Khoa Da liễu",
     ["Vùng ngứa nổi từ bao giờ?", "Bạn có đang bôi thuốc gì không?"]),
    (["KHỚP-GỐI", "GỐI", "KHỚP", "LƯNG", "ĐAU LƯNG", "XƯƠNG", "LOÃNG-XƯƠNG", "TÊ-TAY", "TÊ CHÂN", "CHÂN"],
     "Bệnh lý Cơ - Xương - Khớp", "Khoa Cơ - Xương - Khớp",
     ["Khớp đau khi đi lại hay lúc nghỉ?", "Mời bạn ngồi để bác sĩ kiểm tra khớp"])
]

# Nhóm 2: Triệu chứng toàn thân & Tiêu hóa
GENERAL_SYMPTOMS_MAP = {
    "ĐAU-ĐẦU": "Đau đầu / Nhức đầu",
    "ĐẦU-ĐAU": "Đau đầu / Nhức đầu",
    "ĐAU-BỤNG": "Đau bụng",
    "BỤNG-ĐAU": "Đau bụng",
    "SỐT": "Sốt",
    "HO": "Ho khan / Ho có đờm",
    "KHAN-HO": "Ho khàn tiếng",
    "CHÓNG-MẶT": "Chóng mặt / Choáng váng",
    "CHẢY-MÁU": "Chảy máu",
    "NÔN": "Buồn nôn / Nôn mửa",
    "MỆT": "Mệt mỏi / Suy nhược",
    "TIÊU-CHẢY": "Tiêu chảy / Rối loạn tiêu hóa",
    "MẤT-NGỦ": "Mất ngủ / Khó ngủ",
    "BÉO-PHÌ": "Thừa cân / Béo phì",
    "ĐAU": "Đau nhức cơ thể"
}

ONSET_MAP = {
    "HÔM-QUA": "hôm qua (~24h trước)",
    "HÔM-NAY": "hôm nay (trong ngày)",
    "SÁNG-NAY": "sáng nay",
    "GẦN-ĐÂY": "gần đây (vài ngày gần đây)",
    "1-NGÀY": "khoảng 1 ngày trước",
    "3-NGÀY": "khoảng 3 ngày trước",
    "TUẦN-TRƯỚC": "khoảng 1 tuần trước",
    "LẦN-ĐẦU": "lần đầu tiên xuất hiện"
}

SEVERITY_MAP = {
    "NHIỀU": "Nhiều / Nặng",
    "NẶNG": "Nặng / Dữ dội",
    "NGỨA-NHIỀU": "Ngứa nhiều, khó chịu",
    "DỮ-DỘI": "Dữ dội / Đau nhiều",
    "ÍT": "Ít / Nhẹ",
    "NHẸ": "Nhẹ / Âm ỉ",
    "BÌNH-THƯỜNG": "Bình thường / Vừa phải"
}


def parse_semantic_frame(
    gloss_sequence: Optional[List[str]] = None,
    translation: Optional[str] = None
) -> SemanticFrame:
    """
    Phân tích toàn diện chuỗi Gloss hoặc Câu dịch thành SemanticFrame 7 nhóm.
    """
    raw_text = translation or " ".join(gloss_sequence or [])
    text_upper = raw_text.upper().replace(",", " ").replace(".", " ").replace("?", " ")
    tokens = [t.upper().strip() for t in (gloss_sequence or [])]
    for w in text_upper.split():
        if w not in tokens:
            tokens.append(w)

    # =========================================================================
    # 1. KIỂM TRA DẤU HIỆU CẤP CỨU (EMERGENCY)
    # =========================================================================
    for kw in EMERGENCY_WORDS:
        if kw in tokens or kw in text_upper or kw.replace("-", " ") in text_upper:
            return SemanticFrame(
                intent=IntentType.EMERGENCY,
                specialty="Khoa Cấp cứu (Hồi sức cấp cứu)",
                visit_reason="CẤP CỨU: Phát hiện dấu hiệu nguy hiểm",
                symptoms=["Khó thở / Đau ngực cấp / Chảy máu nhiều / Nguy cơ suy hô hấp"],
                severity="Nghiêm trọng (Nguy kịch)",
                needs_human_review=True,
                review_reasons=["PHÁT HIỆN DẤU HIỆU CẤP CỨU: Điều dưỡng cần kiểm tra sinh hiệu và hỗ trợ ngay lập tức!"],
                summary_for_clinician="⚠️ [CẢNH BÁO ĐỎ] Bệnh nhân có dấu hiệu khó thở / tức ngực cấp. Cần xử trí khẩn cấp!",
                patient_confirmation_text=f"Có phải bạn đang thấy: '{raw_text}' rất khó chịu không? Đội ngũ y tế đang đến hỗ trợ bạn ngay!",
                suggested_action="Kích hoạt còi báo động cấp cứu. Điều dưỡng mang bình oxy và máy đo SpO2 đến tiếp nhận.",
                doctor_quick_responses=["Y tá đang đến hỗ trợ bạn ngay", "Hãy ngồi yên và thở đều", "Bác sĩ đang có mặt"]
            )

    # =========================================================================
    # 2. KIỂM TRA NHÓM 6: HỢP TÁC KHÁM LÂM SÀNG (EXAM_COOPERATION)
    # Ví dụ: Há miệng, cởi áo khoác, bỏ kính, tháo đồ kim loại...
    # =========================================================================
    for keywords, procedure_name, explanation, responses in EXAM_COOPERATION_MAP:
        if any(kw in tokens or kw in text_upper for kw in keywords):
            return SemanticFrame(
                intent=IntentType.EXAM_COOPERATION,
                specialty="Phòng khám lâm sàng (Bác sĩ chuyên khoa)",
                visit_reason=f"Hợp tác thao tác khám: {procedure_name}",
                symptoms=[],
                needs_human_review=False,
                review_reasons=[],
                summary_for_clinician=f"Người bệnh đang hỏi để phối hợp thao tác: '{raw_text}'. Bác sĩ bấm nút phản hồi để hướng dẫn bệnh nhân.",
                patient_confirmation_text=f"Ý của bạn là: '{raw_text}' — Có đúng không?",
                suggested_action=f"Bác sĩ bấm xác nhận để hiển thị chữ to sang màn hình người bệnh: '{explanation}'",
                doctor_quick_responses=responses
            )

    # =========================================================================
    # 3. KIỂM TRA NHÓM 5: CHỈ ĐỊNH CẬN LÂM SÀNG & XÉT NGHIỆM (LAB_DIAGNOSTIC)
    # Ví dụ: Siêu âm bụng, siêu âm tim, X-quang, thử máu...
    # =========================================================================
    for keywords, test_name, department, responses in LAB_DIAGNOSTIC_MAP:
        if any(kw in tokens or kw in text_upper for kw in keywords):
            return SemanticFrame(
                intent=IntentType.LAB_DIAGNOSTIC,
                specialty=department,
                visit_reason=f"Thực hiện cận lâm sàng: {test_name}",
                symptoms=[],
                needs_human_review=False,
                review_reasons=[],
                summary_for_clinician=f"Người bệnh có chỉ định {test_name}. Cần hướng dẫn di chuyển sang {department}.",
                patient_confirmation_text=f"Bạn cần đi làm: '{test_name}', đúng không?",
                suggested_action=f"Xuất phiếu chỉ dẫn và hướng dẫn bệnh nhân di chuyển sang {department}.",
                doctor_quick_responses=responses
            )

    # =========================================================================
    # 4. KIỂM TRA NHÓM 3: RĂNG HÀM MẶT & TAI MŨI HỌNG
    # Ví dụ: Sâu răng, nhổ răng, cạo vôi, viêm xoang, amidan, ù tai...
    # =========================================================================
    for keywords, group_name, dept, responses in ENT_DENTAL_MAP:
        if any(kw in tokens or kw in text_upper for kw in keywords):
            return SemanticFrame(
                intent=IntentType.SPECIALTY_ENT_DENTAL,
                specialty=dept,
                visit_reason=f"Khám chuyên khoa: {group_name}",
                symptoms=[group_name],
                allergy_status="not_confirmed",
                medication_status="unknown",
                needs_human_review=True,
                review_reasons=["Tiền sử dị ứng thuốc tê / kháng sinh: Chưa xác nhận"],
                summary_for_clinician=f"Khám chuyên khoa {dept}: '{raw_text}'. Cần kiểm tra tiền sử dị ứng thuốc tê/kháng sinh trước khi can thiệp.",
                patient_confirmation_text=f"Ý của bạn là: '{raw_text}' — Có đúng không?",
                suggested_action=f"Điều phối người bệnh vào {dept}. Nhân viên kiểm tra tiền sử dị ứng thuốc tê.",
                doctor_quick_responses=responses
            )

    # =========================================================================
    # 5. KIỂM TRA NHÓM 4: MẮT, DA LIỄU & CƠ XƯƠNG KHỚP
    # Ví dụ: Cận thị, ngứa, khớp gối, đau lưng...
    # =========================================================================
    for keywords, group_name, dept, responses in OTHER_SPECIALTY_MAP:
        if any(kw in tokens or kw in text_upper for kw in keywords):
            return SemanticFrame(
                intent=IntentType.SPECIALTY_OTHER,
                specialty=dept,
                visit_reason=f"Khám chuyên khoa: {group_name}",
                symptoms=[group_name],
                allergy_status="not_confirmed",
                medication_status="unknown",
                needs_human_review=True,
                review_reasons=["Cần điều dưỡng đo sinh hiệu và ghi nhận thời gian bị bệnh"],
                summary_for_clinician=f"Bệnh nhân có vấn đề về {group_name} ({dept}): '{raw_text}'.",
                patient_confirmation_text=f"Ý của bạn là: '{raw_text}' — Có đúng không?",
                suggested_action=f"Cấp số thứ tự và phân luồng vào {dept}.",
                doctor_quick_responses=responses
            )

    # =========================================================================
    # 6. KIỂM TRA NHÓM 7: HỎI ĐÁP THÔNG TIN, THỜI GIAN CHỜ & ĐI LẠI (INQUIRY)
    # Ví dụ: Chờ lâu không, phòng số mấy, bao nhiêu tiền, tái khám...
    # =========================================================================
    inquiry_triggers = ["CHỜ", "LÂU", "HẸN", "Ở ĐÂU", "PHÒNG NÀY", "BAO NHIÊU", "CHI PHÍ", "TIỀN", "MẤY GIỜ", "BÁC SĨ TÊN", "TÁI KHÁM"]
    if any(k in text_upper for k in inquiry_triggers) or any(k in tokens for k in ["CHỜ", "LÂU", "HẸN", "CHI-PHÍ", "LỊCH-HẸN"]):
        return SemanticFrame(
            intent=IntentType.INQUIRY,
            specialty="Quầy Tiếp đón & Hướng dẫn",
            visit_reason="Hỏi đáp thông tin thời gian chờ / thủ tục / phòng khám",
            symptoms=[],
            needs_human_review=False,
            review_reasons=[],
            summary_for_clinician=f"Người bệnh hỏi thông tin: '{raw_text}'. Nhân viên chọn câu trả lời nhanh bên dưới.",
            patient_confirmation_text=f"Bạn muốn hỏi: '{raw_text}' — Đúng không?",
            suggested_action="Hệ thống tự động hiển thị thời gian chờ dự kiến (~10-15 phút) trên màn hình người bệnh.",
            doctor_quick_responses=[
                "Dự kiến chờ khoảng 10-15 phút nữa",
                "Đúng rồi, mời bạn ngồi chờ ở phòng này",
                "Chi phí đã được bảo hiểm y tế chi trả",
                "Mời bạn qua Bàn Hướng dẫn số 1"
            ]
        )

    # =========================================================================
    # 7. KIỂM TRA NHÓM 2: TRIỆU CHỨNG NỘI KHOA & TIÊU HÓA TOÀN THÂN (SYMPTOM_REPORT)
    # Ví dụ: Đau đầu, đau bụng, sốt, ho, mệt, nôn...
    # =========================================================================
    detected_symptoms = []
    for k, v in GENERAL_SYMPTOMS_MAP.items():
        if k in tokens or k.replace("-", " ") in text_upper:
            if v not in detected_symptoms:
                detected_symptoms.append(v)

    detected_onset = None
    for k, v in ONSET_MAP.items():
        if k in tokens or k.replace("-", " ") in text_upper:
            detected_onset = v
            break

    detected_severity = None
    for k, v in SEVERITY_MAP.items():
        if k in tokens or k.replace("-", " ") in text_upper:
            detected_severity = v
            break

    if detected_symptoms:
        review_reasons = []
        if not detected_onset:
            review_reasons.append("Chưa rõ thời điểm khởi phát triệu chứng (Onset unknown)")
        if not detected_severity:
            review_reasons.append("Chưa rõ mức độ đau/khó chịu (Severity unknown)")
        review_reasons.append("Tiền sử dị ứng thuốc: Chưa xác nhận (Cần nhân viên hỏi lại)")

        return SemanticFrame(
            intent=IntentType.SYMPTOM_REPORT,
            specialty="Khoa Nội tổng hợp / Tiêu hóa / Hô hấp",
            visit_reason=f"Khai báo triệu chứng: {', '.join(detected_symptoms)}",
            symptoms=detected_symptoms,
            onset=detected_onset,
            severity=detected_severity,
            allergy_status="not_confirmed",
            medication_status="unknown",
            needs_human_review=True,
            review_reasons=review_reasons,
            summary_for_clinician=(
                f"Triệu chứng: {', '.join(detected_symptoms)} | "
                f"Khởi phát: {detected_onset or 'Chưa rõ'} | "
                f"Mức độ: {detected_severity or 'Chưa rõ'}"
            ),
            patient_confirmation_text=f"Ý của bạn là: '{raw_text}' — Có đúng không?",
            suggested_action="Phân luồng vào Khoa Nội. Điều dưỡng kiểm tra tiền sử dị ứng và đo huyết áp.",
            doctor_quick_responses=[
                "Cơn đau xuất hiện từ khi nào?",
                "Bạn đau nhiều hay âm ỉ?",
                "Bạn có bị dị ứng thuốc kháng sinh không?"
            ]
        )

    # =========================================================================
    # 8. MẶC ĐỊNH: NHÓM 1 - TIẾP NHẬN, THỦ TỤC & GIẤY TỜ (REGISTRATION)
    # Ví dụ: Đăng ký khám, bảo hiểm, CCCD, tuổi, nghề nghiệp...
    # =========================================================================
    return SemanticFrame(
        intent=IntentType.REGISTRATION,
        specialty="Bàn Đăng ký khám / Quầy Tiếp đón",
        visit_reason=f"Thủ tục hành chính tiếp nhận: {raw_text}",
        symptoms=[],
        needs_human_review=False,
        review_reasons=[],
        summary_for_clinician=f"Người bệnh khai báo thông tin hành chính: '{raw_text}'.",
        patient_confirmation_text=f"Ý của bạn là: '{raw_text}' — Có đúng không?",
        suggested_action="Xác nhận thông tin hành chính, cấp phiếu số thứ tự vào phòng khám phù hợp.",
        doctor_quick_responses=[
            "Đã nhận thông tin, mời bạn ngồi chờ gọi số",
            "Mời bạn xuất trình thẻ BHYT / CCCD",
            "Mời bạn sang Bàn Lấy Số bên cạnh"
        ]
    )


# --- KIỂM THỬ TOÀN DIỆN 7 NHÓM ---
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
        ("SENT_EMG", ["TÔI", "NGỰC-ĐAU", "KHÓ-THỞ"], "Tôi bị tức ngực và rất khó thở"),
    ]

    print("================== KẾT QUẢ KIỂM THỬ 7 NHÓM NGHIỆP VỤ ==================\n")
    for sid, glosses, text in test_cases:
        res = parse_semantic_frame(gloss_sequence=glosses, translation=text)
        print(f"[{sid}] Câu: '{text}'")
        print(f"  ➔ Intent: {res.intent.value}")
        print(f"  ➔ Chuyên khoa: {res.specialty}")
        print(f"  ➔ Tóm tắt y tế: {res.summary_for_clinician}")
        print(f"  ➔ Gợi ý nút bấm cho Bác sĩ: {res.doctor_quick_responses}")
        print("-" * 75)
