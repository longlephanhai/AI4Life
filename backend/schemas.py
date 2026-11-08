from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class IntentType(str, Enum):
    REGISTRATION = "registration"         # Đăng ký khám bệnh / khám sức khỏe
    SYMPTOM_REPORT = "symptom_report"     # Báo triệu chứng bệnh
    INQUIRY = "inquiry"                   # Hỏi đáp (chờ lâu không, thủ tục, ở đâu)
    EMERGENCY = "emergency"               # Cấp cứu khẩn cấp (khó thở, tức ngực, ngất...)
    GENERAL = "general"                   # Chào hỏi, cảm ơn, giao tiếp thông thường

class SemanticFrame(BaseModel):
    intent: IntentType = Field(..., description="Mục đích của bệnh nhân")
    visit_reason: Optional[str] = Field(None, description="Lý do đến khám chính")
    symptoms: List[str] = Field(default_factory=list, description="Danh sách các triệu chứng")
    body_location: Optional[str] = Field(None, description="Vị trí trên cơ thể (nếu có)")
    onset: Optional[str] = Field(None, description="Thời điểm bắt đầu triệu chứng")
    severity: Optional[str] = Field(None, description="Mức độ nghiêm trọng (nhẹ, vừa, nặng)")
    allergy_status: str = Field(default="not_confirmed", description="Trạng thái tiền sử dị ứng")
    medication_status: str = Field(default="unknown", description="Trạng thái thuốc đang sử dụng")
    
    # An toàn y tế & Human Review
    needs_human_review: bool = Field(False, description="Có cần nhân viên y tế can thiệp/hỏi lại không")
    review_reasons: List[str] = Field(default_factory=list, description="Lý do cần kiểm tra lại")
    
    # Text tổng hợp cho 2 phía
    summary_for_clinician: str = Field(..., description="Bản tóm tắt chuyên môn cho nhân viên y tế")
    patient_confirmation_text: str = Field(..., description="Câu hiển thị cho người bệnh bấm xác nhận")
    suggested_action: str = Field(..., description="Hành động tiếp theo đề xuất (cấp số, hỏi thêm, chuyển cấp cứu)")

class ParseRequest(BaseModel):
    gloss_sequence: Optional[List[str]] = Field(default=None, description="Chuỗi gloss từ mô hình AI")
    translation: Optional[str] = Field(default=None, description="Câu dịch tiếng Việt")

class RecognizeResponse(BaseModel):
    sample_id: Optional[str] = None
    gloss_sequence: List[str]
    translation: str
    confidence: float
    semantic_frame: SemanticFrame

