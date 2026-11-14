"""
triage_kb.py
------------
Bộ nạp và truy xuất Kho tri thức phân luồng y tế (triage_kb.json).
Phục vụ 2 mục tiêu:
1. Chạy hoàn toàn offline cho tầng Rule + Retrieval hiện tại (tách khoa rạch ròi,
   bắt cờ đỏ cấp cứu theo triệu chứng và gợi ý câu hỏi theo slot còn thiếu).
2. Làm tầng Retriever chuẩn (Top-K Knowledge Nodes + Graph Edges) sẵn sàng cấp ngữ cảnh
   cho RAG + Prompting đa lượt ở bước nâng cấp tiếp theo.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

KB_PATH = Path(__file__).resolve().parent / "data" / "triage_kb.json"


def _normalize_text(text: str) -> str:
    cleaned = re.sub(r"[,.?!:;()\[\]\"]+", " ", (text or "").upper())
    return re.sub(r"\s+", " ", cleaned).strip()


def _tokenize_upper(text_upper: str, gloss_sequence: Optional[List[str]] = None) -> List[str]:
    tokens: List[str] = []
    for g in gloss_sequence or []:
        tok = g.upper().strip()
        if tok and tok not in tokens:
            tokens.append(tok)
    for w in text_upper.split():
        if w and w not in tokens:
            tokens.append(w)
    return tokens


def _match_trigger(trigger: str, text_upper: str, tokens: List[str]) -> bool:
    trg = trigger.upper().strip()
    if not trg:
        return False
    if trg in tokens:
        return True
    trg_space = trg.replace("-", " ")
    # Khớp ranh giới cụm từ để tránh bắt nhầm tiền tố (VD: "HO" không khớp "KHÓ" hay "CHO")
    pattern = rf"(?:^|\s){re.escape(trg_space)}(?:$|\s)"
    if re.search(pattern, text_upper):
        return True
    if "-" in trg:
        pattern_dash = rf"(?:^|\s){re.escape(trg)}(?:$|\s)"
        if re.search(pattern_dash, text_upper):
            return True
    return False


class TriageKnowledgeBase:
    """Quản lý truy xuất node tri thức phân luồng và trích xuất slot hội thoại."""

    def __init__(self, kb_path: Path = KB_PATH):
        self.kb_path = kb_path
        self.data: Dict[str, Any] = {}
        self.nodes: List[Dict[str, Any]] = []
        self.emergency_triggers: List[str] = []
        self.slot_patterns: Dict[str, List[Dict[str, Any]]] = {}
        self._load()

    def _load(self) -> None:
        if not self.kb_path.exists():
            raise FileNotFoundError(f"Không tìm thấy kho tri thức phân luồng tại {self.kb_path}")
        with open(self.kb_path, "r", encoding="utf-8") as f:
            self.data = json.load(f)
        self.nodes = self.data.get("nodes", [])
        self.emergency_triggers = self.data.get("emergency_global_triggers", [])
        self.slot_patterns = self.data.get("slot_patterns", {})

    def collect_patient_context(
        self,
        gloss_sequence: Optional[List[str]] = None,
        translation: Optional[str] = None,
        dialogue_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[str, str, List[str]]:
        """
        Gom lượt hiện tại và lịch sử tin nhắn phía bệnh nhân (nếu có) thành ngữ cảnh thống nhất.
        Trả về: (latest_raw_text, combined_text_upper, combined_tokens)
        """
        patient_texts: List[str] = []
        merged_glosses: List[str] = []

        for msg in dialogue_history or []:
            if msg.get("sender") == "patient":
                txt = (msg.get("text") or "").strip()
                if txt and txt not in patient_texts:
                    patient_texts.append(txt)
                for g in msg.get("gloss_sequence") or []:
                    gu = g.upper().strip()
                    if gu and gu not in merged_glosses:
                        merged_glosses.append(gu)

        latest_raw = (translation or "").strip() or " ".join(gloss_sequence or []).strip()
        if latest_raw and latest_raw not in patient_texts:
            patient_texts.append(latest_raw)
        for g in gloss_sequence or []:
            gu = g.upper().strip()
            if gu and gu not in merged_glosses:
                merged_glosses.append(gu)

        combined_raw = " ; ".join(patient_texts) if patient_texts else latest_raw
        combined_upper = _normalize_text(combined_raw)
        combined_tokens = _tokenize_upper(combined_upper, merged_glosses)
        return latest_raw, combined_upper, combined_tokens

    def extract_slots(self, text_upper: str, tokens: List[str]) -> Dict[str, Optional[str]]:
        """Trích xuất các slot lâm sàng (onset, severity, body_location, allergy_status, medication_status)."""
        slots: Dict[str, Optional[str]] = {
            "onset": None,
            "severity": None,
            "body_location": None,
            "allergy_status": "not_confirmed",
            "medication_status": "unknown",
        }

        for slot_key in ("onset", "severity", "body_location"):
            for rule in self.slot_patterns.get(slot_key, []):
                if any(_match_trigger(t, text_upper, tokens) for t in rule.get("triggers", [])):
                    slots[slot_key] = rule.get("value")
                    break

        # Bắt động mọi mốc thời gian dạng số bất kỳ (VD: "5 ngày", "2 tuần", "4 tháng")
        if not slots["onset"]:
            m_onset = re.search(
                r"\b(\d+(?:[.,]\d+)?)[-\s]*(NGÀY|TUẦN|THÁNG|GIỜ|NĂM)\b",
                text_upper,
            )
            if m_onset:
                slots["onset"] = f"khoảng {m_onset.group(1)} {m_onset.group(2).lower()} trước"

        for rule in self.slot_patterns.get("allergy", []):
            if any(_match_trigger(t, text_upper, tokens) for t in rule.get("triggers", [])):
                slots["allergy_status"] = rule.get("status", "confirmed")
                break

        for rule in self.slot_patterns.get("medication", []):
            if any(_match_trigger(t, text_upper, tokens) for t in rule.get("triggers", [])):
                slots["medication_status"] = rule.get("status", "confirmed")
                break

        return slots

    def retrieve_nodes(
        self,
        text_upper: str,
        tokens: List[str],
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Truy xuất Top-K node tri thức khớp nhất từ triage_kb.json.
        Dùng chung cho cả tầng Offline hiện tại và tầng RAG Context ở bước sau.
        """
        # Loại bỏ các cụm phủ định khi trả lời câu hỏi sàng lọc (VD: "không dị ứng")
        # để tránh kéo nhầm sang node Da liễu khi bệnh nhân đang trả lời về dị ứng thuốc.
        retrieval_text = re.sub(
            r"\b(?:KHÔNG|CHƯA|CHƯA TỪNG)\s+(?:BỊ\s+|CÓ\s+)?(?:DỊ\s+ỨNG(?:\s+THUỐC)?|DỊ-ỨNG)\b",
            " ",
            text_upper,
        )
        retrieval_text = re.sub(r"\s+", " ", retrieval_text).strip()
        retrieval_tokens = [
            t for t in tokens
            if not (t == "DỊ-ỨNG" and retrieval_text != text_upper and "DỊ ỨNG" not in retrieval_text)
        ]

        scored: List[Tuple[float, int, Dict[str, Any], List[str]]] = []

        for node in self.nodes:
            matched_triggers: List[str] = []
            gloss_hits = 0
            text_hits = 0

            for g in node.get("gloss_triggers", []):
                if _match_trigger(g, retrieval_text, retrieval_tokens):
                    gloss_hits += 1
                    matched_triggers.append(g)

            for kw in node.get("text_keywords", []):
                if _match_trigger(kw, retrieval_text, retrieval_tokens):
                    text_hits += 1
                    if kw not in matched_triggers:
                        matched_triggers.append(kw)

            total_hits = gloss_hits + text_hits
            if total_hits == 0:
                continue

            priority = int(node.get("priority", 0))
            # Cụm từ dài hơn (VD: "SIÊU ÂM TIM" vs "SIÊU ÂM") được thưởng điểm cụ thể
            specificity = max((len(t) for t in matched_triggers), default=0) * 0.1
            score = priority + total_hits * 2.5 + specificity
            scored.append((score, priority, node, matched_triggers))

        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)

        results: List[Dict[str, Any]] = []
        for score, _, node, triggers in scored[:top_k]:
            item = dict(node)
            item["_score"] = round(score, 2)
            item["_matched_triggers"] = triggers
            results.append(item)
        return results

    def check_emergency(
        self,
        matched_nodes: List[Dict[str, Any]],
        text_upper: str,
        tokens: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Kiểm tra cờ đỏ toàn cục và cạnh red_flags trên các node triệu chứng vừa khớp."""
        if any(_match_trigger(t, text_upper, tokens) for t in self.emergency_triggers):
            emg_node = next((n for n in self.nodes if n.get("id") == "emergency_critical"), None)
            if emg_node:
                return {
                    "specialty": emg_node["specialty"],
                    "alert": "Phát hiện dấu hiệu nguy hiểm cần kiểm tra sinh hiệu và xử trí ngay!",
                    "suggested_action": emg_node["suggested_action"],
                    "responses": emg_node.get("default_responses", []),
                }

        for node in matched_nodes:
            rf = node.get("red_flags")
            if not rf:
                continue
            if any(_match_trigger(t, text_upper, tokens) for t in rf.get("triggers", [])):
                emg_node = next((n for n in self.nodes if n.get("id") == "emergency_critical"), None)
                return {
                    "specialty": rf.get("escalate_to") or "Khoa Cấp cứu (Hồi sức cấp cứu)",
                    "alert": rf.get("alert") or "Phát hiện dấu hiệu cảnh báo đỏ đi kèm triệu chứng!",
                    "suggested_action": emg_node["suggested_action"] if emg_node else "Chuyển ngay khu vực Cấp cứu.",
                    "responses": emg_node.get("default_responses", []) if emg_node else [
                        "Y tá đang đến hỗ trợ bạn ngay",
                        "Hãy ngồi yên và thở đều",
                    ],
                }
        return None

    def build_follow_up_questions(
        self,
        matched_nodes: List[Dict[str, Any]],
        slots: Dict[str, Optional[str]],
        max_questions: int = 3,
    ) -> Tuple[List[str], List[str]]:
        """
        Sinh danh sách:
        - review_reasons: những ô thông tin lâm sàng còn thiếu.
        - quick_responses: câu hỏi tiếp theo được thiết kế riêng cho triệu chứng đó
          (tự động bỏ qua câu đã có câu trả lời ở các lượt trước).
        """
        review_reasons: List[str] = []
        quick_questions: List[str] = []
        seen_slots: Set[str] = set()

        slot_labels = {
            "body_location": "Chưa rõ vị trí cụ thể",
            "onset": "Chưa rõ thời điểm khởi phát triệu chứng",
            "severity": "Chưa rõ mức độ nặng/nhẹ",
            "allergy": "Tiền sử dị ứng thuốc: Chưa xác nhận",
        }

        for node in matched_nodes:
            if node.get("intent") not in {"symptom_report", "specialty_ent_dental", "specialty_other"}:
                continue
            fmap = node.get("follow_up_questions", {})
            for slot_name in node.get("required_slots", []):
                is_missing = (
                    slots.get("allergy_status") == "not_confirmed"
                    if slot_name == "allergy"
                    else not slots.get(slot_name)
                )
                if not is_missing or slot_name in seen_slots:
                    continue
                seen_slots.add(slot_name)
                label = slot_labels.get(slot_name)
                if label and label not in review_reasons:
                    review_reasons.append(label)
                q = fmap.get(slot_name)
                if q and q not in quick_questions:
                    quick_questions.append(q)

        # Nếu bệnh nhân đã trả lời đủ các slot lâm sàng, gợi ý câu xác nhận chuyển phòng khám
        if not quick_questions and matched_nodes:
            primary = matched_nodes[0]
            defaults = primary.get("default_responses", [])
            for resp in defaults:
                if resp not in quick_questions:
                    quick_questions.append(resp)
            if primary.get("intent") == "symptom_report":
                handoff = f"Đã ghi nhận đủ thông tin, mời bạn vào {primary.get('specialty', 'Phòng khám')}"
                quick_questions.insert(0, handoff)

        return review_reasons, quick_questions[:max_questions]

    def get_default_registration_node(self) -> Dict[str, Any]:
        node = next((n for n in self.nodes if n.get("id") == "registration_default"), None)
        if node:
            return node
        return {
            "id": "registration_default",
            "intent": "registration",
            "specialty": "Bàn Đăng ký khám / Quầy Tiếp đón",
            "default_responses": [
                "Đã nhận thông tin, mời bạn ngồi chờ gọi số",
                "Mời bạn xuất trình thẻ BHYT / CCCD",
            ],
            "suggested_action": "Xác nhận thông tin hành chính, cấp số thứ tự và hướng dẫn bàn tiếp nhận.",
        }


triage_kb = TriageKnowledgeBase()
