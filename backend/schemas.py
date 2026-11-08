from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

class IntentType(str, Enum):
    REGISTRATION = "registration"                 # Nhóm 1: Đăng ký / Tiếp nhận / Giấy tờ / Cá nhân
    SYMPTOM_REPORT = "symptom_report"             # Nhóm 2: Khai báo triệu chứng toàn thân & nội khoa
    SPECIALTY_ENT_DENTAL = "specialty_ent_dental" # Nhóm 3: Răng - Hàm - Mặt & Tai - Mũi - Họng
    SPECIALTY_OTHER = "specialty_other"           # Nhóm 4: Mắt, Da liễu & Cơ - Xương - Khớp
    LAB_DIAGNOSTIC = "lab_diagnostic"             # Nhóm 5: Chỉ định Cận lâm sàng & Xét nghiệm
    EXAM_COOPERATION = "exam_cooperation"         # Nhóm 6: Hợp tác khám lâm sàng (Há miệng, cởi áo...)
    INQUIRY = "inquiry"                           # Nhóm 7: Hỏi đáp thông tin, thời gian chờ, phòng khám
    EMERGENCY = "emergency"                       # Cấp cứu khẩn cấp (Khó thở, đau ngực, nguy kịch)
    GENERAL = "general"                           # Giao tiếp thông thường

class SemanticFrame(BaseModel):
    intent: IntentType = Field(..., description="Mục đích / Nhóm nghiệp vụ của người bệnh")
    specialty: Optional[str] = Field(None, description="Chuyên khoa phù hợp (Nha khoa, Mắt, Tai Mũi Họng, Tiêu hóa...)")
    visit_reason: Optional[str] = Field(None, description="Lý do đến khám chính")
    symptoms: List[str] = Field(default_factory=list, description="Danh sách các triệu chứng phát hiện được")
    body_location: Optional[str] = Field(None, description="Vị trí trên cơ thể (nếu có)")
    onset: Optional[str] = Field(None, description="Thời điểm bắt đầu triệu chứng")
    severity: Optional[str] = Field(None, description="Mức độ nghiêm trọng (nhẹ, vừa, nặng)")
    allergy_status: str = Field(default="not_confirmed", description="Trạng thái tiền sử dị ứng (confirmed / not_confirmed)")
    medication_status: str = Field(default="unknown", description="Trạng thái thuốc đang sử dụng (unknown / confirmed)")
    
    # An toàn y tế & Human Review
    needs_human_review: bool = Field(False, description="Có cần nhân viên y tế can thiệp/hỏi lại không")
    review_reasons: List[str] = Field(default_factory=list, description="Lý do cần kiểm tra lại")
    
    # Text tổng hợp cho 2 phía
    summary_for_clinician: str = Field(..., description="Bản tóm tắt chuyên môn cho nhân viên y tế")
    patient_confirmation_text: str = Field(..., description="Câu hiển thị cho người bệnh bấm xác nhận")
    suggested_action: str = Field(..., description="Hành động tiếp theo đề xuất (cấp số, hỏi thêm, chuyển cấp cứu)")
    doctor_quick_responses: List[str] = Field(default_factory=list, description="Các câu trả lời nhanh gợi ý cho bác sĩ bấm phản hồi")

class ParseRequest(BaseModel):
    gloss_sequence: Optional[List[str]] = Field(default=None, description="Chuỗi gloss từ mô hình AI")
    translation: Optional[str] = Field(default=None, description="Câu dịch tiếng Việt")


class RecognitionStatus(str, Enum):
    RECOGNIZED = "recognized"                   # Nhận diện thành công với độ tin cậy cao
    LOW_CONFIDENCE = "low_confidence"           # AI không chắc chắn (dưới ngưỡng an toàn)
    OUT_OF_VOCABULARY = "out_of_vocabulary"     # Ký hiệu nằm ngoài bộ từ điển AI đã học
    HANDS_NOT_DETECTED = "hands_not_detected"   # Tay nằm ngoài khung hình hoặc bị che khuất
    NO_MOVEMENT = "no_movement"                 # Chưa thực hiện động tác ký hiệu rõ ràng
    INVALID_VIDEO = "invalid_video"             # Video quá ngắn hoặc không đọc được


class RecognizeResponse(BaseModel):
    sample_id: Optional[str] = None
    is_recognized: bool = True
    recognition_status: RecognitionStatus = RecognitionStatus.RECOGNIZED
    fallback_message: Optional[str] = None
    gloss_sequence: List[str]
    translation: str
    confidence: float
    semantic_frame: SemanticFrame
    extracted_frames: Optional[List[List[float]]] = None
    diagnostics: Optional[Dict[str, Any]] = None
