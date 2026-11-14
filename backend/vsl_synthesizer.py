"""
vsl_synthesizer.py
------------------
Bộ tổng hợp phản hồi Ngôn ngữ ký hiệu VSL theo hướng Data-driven (dựa trên dữ liệu VSL-GH):
1. Auto-Lexicon: Tự động quét 368 gloss có mốc `gloss_frame_boundaries` trong dataset.json,
   sinh từ điển cụm từ tiếng Việt và biến thể đảo trật tự VSL (VD: NGỦ-KHÓ <-> "khó ngủ").
2. TF-IDF Retrieval: Tự động lập chỉ mục 366 cặp câu chuẩn (translation -> gloss_sequence),
   bao gồm chuyển đổi góc nhìn ("Bác sĩ hỏi tôi..." -> câu hỏi trực tiếp của bác sĩ),
   kèm kiểm định an toàn ngữ nghĩa (tránh lệch phủ định / sai danh từ y khoa).
3. Stitched Skeleton Playback: Cắt khung xương ưu tiên người mẫu S01 (_F),
   chuẩn hóa tâm/tỷ lệ vai và nội suy 5 frame chuyển tiếp mượt giữa các gloss.
"""

import json
import logging
import math
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
import numpy as np

logger = logging.getLogger("vsl_synthesizer")

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_JSON_PATH = BASE_DIR / "AI" / "data" / "dataset.json"
KEYPOINTS_DIR = BASE_DIR / "AI" / "data" / "keypoints"

# Quy tắc an toàn tối thiểu cho các câu hỏi/chỉ dẫn y tế nhạy cảm thường gặp tại quầy tiếp nhận
SAFETY_CLINICAL_RULES: List[Tuple[List[str], List[str]]] = [
    (["bị sao", "làm sao", "triệu chứng gì", "vấn đề gì"], ["BỆNH-GÌ", "ĐAU", "Ở-ĐÂU"]),
    (["đau ở đâu", "đau chỗ nào", "vị trí nào"], ["ĐAU", "Ở-ĐÂU"]),
    (["dị ứng thuốc", "dị ứng kháng sinh"], ["DỊ-ỨNG", "THUỐC", "CÓ-KHÔNG"]),
    (["bhyt", "bảo hiểm y tế"], ["THẺ", "BẢO-HIỂM", "LẤY", "XEM"]),
    (["xắn tay áo"], ["VÉN-ÁO", "ĐO", "HUYẾT-ÁP"]),
]

# Chỉ giữ các từ viết tắt / đồng nghĩa không suy ra trực tiếp được từ tên Gloss
ABBREV_SYNONYMS: Dict[str, str] = {
    "bhyt": "BẢO-HIỂM",
    "căn cước": "CCCD",
    "xuất trình": "LẤY",
    "điều dưỡng": "Y-TÁ",
    "nhân viên": "Y-TẾ",
    "xắn tay áo": "VÉN-ÁO",
    "bao giờ": "KHI-NÀO",
    "tái khám": "QUAY-LẠI",
    "như thế nào": "SAO-KHÔNG",
    "thế nào": "SAO-KHÔNG",
    "như nào": "SAO-KHÔNG",
    "bàn": "QUẦY",
    "chờ": "ĐỢI",
    "sang": "ĐI",
    "qua": "ĐI",
    "tháo": "BỎ-RA",
    "bỏ": "BỎ-RA",
}

# Hư từ / đại từ / tiểu từ tình thái tiếng Việt (không mang nghĩa ký hiệu độc lập)
VI_FUNCTION_WORDS: Set[str] = {
    "mời", "bạn", "anh", "chị", "cô", "chú", "bác", "em", "hãy", "vui", "lòng",
    "xin", "của", "và", "với", "để", "cho", "vào", "ra", "lên", "xuống", "lại",
    "đang", "đã", "sẽ", "bị", "được", "thì", "là", "này", "đó", "nhé", "nha",
    "ạ", "ơi", "hay", "hoặc", "nữa", "rất", "hơi", "quá", "từ", "trong", "ngoài",
    "vậy", "thế", "hả", "à", "nhỉ", "chứ", "như", "sao", "mà", "nên", "thấy",
}

WH_PHRASES = (
    "bị sao", "làm sao", "tại sao", "vì sao", "bệnh gì", "thế nào",
    "như nào", "ở đâu", "khi nào", "bao lâu", "bao nhiêu",
)
WH_TOKENS: Set[str] = {"gì", "đâu", "nào", "sao", "mấy"}
QUESTION_END_GLOSSES: Set[str] = {
    "CÓ-KHÔNG", "PHẢI-KHÔNG", "ĐÚNG-KHÔNG", "CẦN-KHÔNG", "ĐƯỢC-KHÔNG",
    "ĐAU-KHÔNG", "SAO-KHÔNG", "BAO-LÂU", "KHI-NÀO", "Ở-ĐÂU", "BAO-NHIÊU",
    "BỆNH-GÌ", "TẠI-SAO", "GÌ", "ĐÂU",
}


class VSLSynthesizer:
    def __init__(self):
        self.sentence_index: Dict[str, dict] = {}
        self.gloss_clips: Dict[str, Tuple[str, int, int]] = {}
        self.auto_lexicon: Dict[str, str] = {}
        self.npy_cache: Dict[str, np.ndarray] = {}

        # Chỉ mục TF-IDF cho truy xuất câu gần nghĩa
        self.tfidf_entries: List[dict] = []
        self.tfidf_vocab: Dict[str, int] = {}
        self.tfidf_idf: Optional[np.ndarray] = None
        self.tfidf_matrix: Optional[np.ndarray] = None

        self.canonical_cx = 0.50
        self.canonical_cy = 0.34
        self.canonical_scale = 0.24

        self._load_index()
        self._build_auto_lexicon()
        self._build_tfidf_index()

    def _load_index(self):
        if not DATASET_JSON_PATH.exists():
            logger.warning("[VSLSynthesizer] Không tìm thấy dataset.json")
            return

        try:
            with open(DATASET_JSON_PATH, encoding="utf-8") as f:
                data = json.load(f)

            # Ưu tiên người mẫu S01 và góc chính diện _F
            sorted_data = sorted(
                data,
                key=lambda x: (
                    0 if "_S01_" in x.get("id", "") else 1,
                    0 if x.get("id", "").endswith("_F") else 1,
                    x.get("id", ""),
                ),
            )

            for item in sorted_data:
                vid = item.get("id", "")
                if not vid.endswith("_F"):
                    continue
                if not (KEYPOINTS_DIR / f"{vid}.npy").exists():
                    continue

                trans = (item.get("translation") or "").strip()
                norm_trans = self._normalize_text(trans)
                boundaries = [
                    b for b in item.get("gloss_frame_boundaries", [])
                    if b.get("gloss") and b.get("gloss") != "Gloss" and b.get("end", 0) > b.get("start", 0)
                ]

                if norm_trans and norm_trans not in self.sentence_index:
                    self.sentence_index[norm_trans] = {
                        "video_id": vid,
                        "sentence_id": vid.split("_")[0],
                        "translation": trans,
                        "gloss_sequence": [g for g in item.get("gloss_sequence", []) if g],
                        "gloss_frame_boundaries": boundaries,
                    }

                for b in boundaries:
                    g = b["gloss"]
                    if g not in self.gloss_clips:
                        self.gloss_clips[g] = (vid, int(b["start"]), int(b["end"]))

            # Lấy khung tham chiếu vai từ mẫu S01 đầu tiên
            for entry in self.sentence_index.values():
                if "_S01_" in entry["video_id"]:
                    arr = self._load_npy(entry["video_id"])
                    if arr is not None and len(arr) > 0:
                        cx, cy, sc = self._estimate_body_anchor(arr)
                        if sc > 0.05:
                            self.canonical_cx, self.canonical_cy, self.canonical_scale = cx, cy, sc
                        break

            logger.info(
                f"[VSLSynthesizer] Data-driven index: {len(self.sentence_index)} câu, {len(self.gloss_clips)} gloss."
            )
        except Exception as e:
            logger.warning(f"[VSLSynthesizer] Lỗi nạp chỉ mục: {e}")

    def _build_auto_lexicon(self):
        """
        Tự động sinh từ điển Tiếng Việt -> Gloss từ 368 nhãn gloss thật trong dataset.json,
        kể cả các cụm đảo trật tự VSL (VD: NGỦ-KHÓ -> 'khó ngủ', ĐẦU-ĐAU -> 'đau đầu').
        """
        lex: Dict[str, str] = {}
        # 1. Ánh xạ trực tiếp từ tên Gloss (VD: "THƯỜNG-XUYÊN" -> "thường xuyên")
        for g in sorted(self.gloss_clips.keys()):
            if g == "IX":
                continue
            spaced = g.lower().replace("-", " ").strip()
            if spaced:
                lex[spaced] = g

        # 2. Tự động sinh biến thể đảo từ cho các Gloss ghép 2 âm tiết kiểu VSL (Danh-Tính / Danh-Động)
        for g in sorted(self.gloss_clips.keys()):
            parts = g.lower().split("-")
            if len(parts) == 2 and parts[1] not in ("không", "chưa", "gì", "đâu", "nào", "lâu"):
                rev = f"{parts[1]} {parts[0]}"
                if rev not in lex:
                    lex[rev] = g

        # 3. Hợp nhất một số viết tắt/đồng nghĩa không suy ra trực tiếp từ tên gloss
        for k, v in ABBREV_SYNONYMS.items():
            if v in self.gloss_clips:
                lex[k] = v

        self.auto_lexicon = lex

    def _tokenize_for_tfidf(self, norm_text: str) -> List[str]:
        words = [w for w in norm_text.split() if w not in VI_FUNCTION_WORDS and w not in ("tôi", "bác", "sĩ", "hỏi")]
        if not words:
            words = norm_text.split()
        ngrams = list(words)
        for i in range(len(words) - 1):
            ngrams.append(f"{words[i]}_{words[i + 1]}")
        return ngrams

    def _build_tfidf_index(self):
        """
        Xây dựng ma trận TF-IDF trên toàn bộ cặp câu trong dataset.json.
        Tự động tạo thêm góc nhìn câu hỏi bác sĩ cho các câu dạng "Bác sĩ hỏi tôi ...".
        """
        entries: List[dict] = []
        seen_norms: Set[str] = set()

        for norm_trans, item in self.sentence_index.items():
            raw_glosses = [g for g in item["gloss_sequence"] if g in self.gloss_clips]
            if not raw_glosses:
                continue

            if norm_trans not in seen_norms:
                entries.append({
                    "norm_text": norm_trans,
                    "gloss_sequence": raw_glosses,
                    "tokens": self._tokenize_for_tfidf(norm_trans),
                    "is_full": True,
                    "entry": item,
                })
                seen_norms.add(norm_trans)

            # Chuyển góc nhìn: "bác sĩ hỏi tôi <nội dung> hả" -> "<nội dung>"
            if norm_trans.startswith("bác sĩ hỏi tôi "):
                stripped = re.sub(r"^bác sĩ hỏi tôi\s+", "", norm_trans)
                stripped = re.sub(r"\s+(hả|ạ|nhé)$", "", stripped).strip()
                clinician_glosses = [
                    g for g in raw_glosses
                    if g not in ("TÔI", "BÁC-SĨ", "HỎI", "HỎI-TÔI")
                ]
                if stripped and clinician_glosses and stripped not in seen_norms:
                    entries.append({
                        "norm_text": stripped,
                        "gloss_sequence": clinician_glosses,
                        "tokens": self._tokenize_for_tfidf(stripped),
                        "is_full": False,
                        "entry": None,
                    })
                    seen_norms.add(stripped)

        if not entries:
            return

        df: Counter = Counter()
        for e in entries:
            for tok in set(e["tokens"]):
                df[tok] += 1

        N = len(entries)
        vocab = {tok: idx for idx, tok in enumerate(sorted(df.keys()))}
        idf = np.array([math.log((1.0 + N) / (1.0 + df[tok])) + 1.0 for tok in sorted(df.keys())], dtype=np.float32)

        mat = np.zeros((N, len(vocab)), dtype=np.float32)
        for row_idx, e in enumerate(entries):
            tf = Counter(e["tokens"])
            for tok, cnt in tf.items():
                col_idx = vocab[tok]
                mat[row_idx, col_idx] = (1.0 + math.log(cnt)) * idf[col_idx]
            norm_val = float(np.linalg.norm(mat[row_idx]))
            if norm_val > 0:
                mat[row_idx] /= norm_val

        self.tfidf_entries = entries
        self.tfidf_vocab = vocab
        self.tfidf_idf = idf
        self.tfidf_matrix = mat

    def _detect_question_type(self, norm_text: str) -> Tuple[bool, bool]:
        """Phân biệt câu hỏi mở (WH) và câu hỏi Có/Không."""
        tokens = norm_text.split()
        is_wh = any(p in norm_text for p in WH_PHRASES) or any(t in WH_TOKENS for t in tokens)
        is_yn = (not is_wh) and (
            ("có" in tokens and ("không" in tokens or "chưa" in tokens))
            or norm_text.endswith(("không", "chưa", "phải không", "được không"))
        )
        return is_wh, is_yn

    def _retrieve_similar_sentence(self, text: str, norm_text: str) -> Optional[dict]:
        """Truy xuất câu gần nghĩa nhất trong dataset.json bằng Cosine TF-IDF kèm kiểm định an toàn."""
        if self.tfidf_matrix is None or self.tfidf_idf is None or not self.tfidf_vocab:
            return None

        # Không khớp truy xuất câu cũ nếu trong câu bác sĩ có mã phòng / số cụ thể (VD: P.204)
        if re.search(r"(?:p\.\d+|phòng\s+\d+|\d{2,})", text, flags=re.IGNORECASE):
            return None

        q_tokens = self._tokenize_for_tfidf(norm_text)
        if not q_tokens:
            return None

        q_vec = np.zeros(len(self.tfidf_vocab), dtype=np.float32)
        tf = Counter(q_tokens)
        for tok, cnt in tf.items():
            if tok in self.tfidf_vocab:
                idx = self.tfidf_vocab[tok]
                q_vec[idx] = (1.0 + math.log(cnt)) * self.tfidf_idf[idx]
        q_norm = float(np.linalg.norm(q_vec))
        if q_norm == 0:
            return None
        q_vec /= q_norm

        sims = self.tfidf_matrix @ q_vec
        best_idx = int(np.argmax(sims))
        best_score = float(sims[best_idx])
        if best_score < 0.72:
            return None

        candidate = self.tfidf_entries[best_idx]
        q_wh, q_yn = self._detect_question_type(norm_text)
        c_wh, c_yn = self._detect_question_type(candidate["norm_text"])
        if q_wh != c_wh or q_yn != c_yn:
            return None

        return candidate

    def _normalize_text(self, text: str) -> str:
        t = text.lower().strip()
        t = re.sub(r"[?!.,:;\"'()\[\]]+", " ", t)
        return re.sub(r"\s+", " ", t).strip()

    def _load_npy(self, video_id: str) -> Optional[np.ndarray]:
        if video_id in self.npy_cache:
            return self.npy_cache[video_id]
        path = KEYPOINTS_DIR / f"{video_id}.npy"
        if not path.exists():
            return None
        arr = np.load(str(path)).astype(np.float32)
        if len(self.npy_cache) < 250:
            self.npy_cache[video_id] = arr
        return arr

    def _estimate_body_anchor(self, kp: np.ndarray) -> Tuple[float, float, float]:
        """Ước lượng tâm vai (pose idx 9 & 10 trong subset 25 điểm) và bề rộng vai."""
        ls_x, ls_y = kp[:, 9 * 3], kp[:, 9 * 3 + 1]
        rs_x, rs_y = kp[:, 10 * 3], kp[:, 10 * 3 + 1]
        valid = (ls_x > 0) & (rs_x > 0)
        if not valid.any():
            return self.canonical_cx, self.canonical_cy, self.canonical_scale
        cx = float(((ls_x[valid] + rs_x[valid]) / 2.0).mean())
        cy = float(((ls_y[valid] + rs_y[valid]) / 2.0).mean())
        scale = float(np.sqrt((rs_x[valid] - ls_x[valid]) ** 2 + (rs_y[valid] - ls_y[valid]) ** 2).mean())
        return cx, cy, max(scale, 0.05)

    def _align_clip_to_canonical(self, clip: np.ndarray) -> np.ndarray:
        """Chuẩn hóa tâm và tỷ lệ vai của clip gloss về cùng kích thước chuẩn S01 để ghép không bị giật."""
        cx, cy, scale = self._estimate_body_anchor(clip)
        ratio = self.canonical_scale / scale
        out = clip.copy()
        det_x = out[:, 0::3] != 0.0
        det_y = out[:, 1::3] != 0.0
        out[:, 0::3] = np.where(det_x, (out[:, 0::3] - cx) * ratio + self.canonical_cx, 0.0)
        out[:, 1::3] = np.where(det_y, (out[:, 1::3] - cy) * ratio + self.canonical_cy, 0.0)
        out[:, 2::3] = out[:, 2::3] * ratio
        return out

    def _interpolate_transition(self, end_frame: np.ndarray, start_frame: np.ndarray, steps: int = 5) -> np.ndarray:
        """Tạo `steps` frame nối mượt giữa frame cuối của gloss i và frame đầu của gloss i+1."""
        bridge = np.zeros((steps, end_frame.shape[0]), dtype=np.float32)
        both_valid = (end_frame != 0.0) & (start_frame != 0.0)
        for s in range(steps):
            alpha = (s + 1) / (steps + 1)
            nearest = end_frame if alpha < 0.5 else start_frame
            linear = (1.0 - alpha) * end_frame + alpha * start_frame
            bridge[s] = np.where(both_valid, linear, nearest)
        return bridge

    def text_to_vsl_glosses(self, text: str) -> Tuple[List[str], List[str], Optional[dict]]:
        """
        Chuyển câu tiếng Việt của bác sĩ thành:
        (gloss_sequence, missing_terms, matched_full_sentence_entry)
        """
        norm = self._normalize_text(text)
        if not norm:
            return [], [], None

        # 1. Khớp nguyên câu chuẩn trong VSL-GH
        if norm in self.sentence_index:
            entry = self.sentence_index[norm]
            return entry["gloss_sequence"], [], entry

        # 2. Kiểm tra quy tắc an toàn cho các câu hỏi lâm sàng nhạy cảm
        for triggers, template_glosses in SAFETY_CLINICAL_RULES:
            if any(tr in norm for tr in triggers):
                missing = re.findall(r"(?:p\.\d+|phòng\s+\d+|\d{2,})", text, flags=re.IGNORECASE)
                valid_glosses = [g for g in template_glosses if g in self.gloss_clips]
                return valid_glosses, [m.strip() for m in missing if m.strip()], None

        # 3. Truy xuất Data-driven TF-IDF trên toàn bộ câu chuẩn & biến thể góc nhìn bác sĩ
        retrieved = self._retrieve_similar_sentence(text, norm)
        if retrieved:
            # Nếu câu gốc trong dataset ở ngôi tường thuật ("Bác sĩ hỏi tôi..."),
            # lọc bỏ ngôi tự xưng để chuyển sang góc nhìn bác sĩ đang hỏi trực tiếp bệnh nhân
            if (
                retrieved["is_full"]
                and retrieved["norm_text"].startswith("bác sĩ hỏi tôi ")
                and "bác sĩ" not in norm
            ):
                clinician_glosses = [
                    g for g in retrieved["gloss_sequence"]
                    if g not in ("TÔI", "BÁC-SĨ", "HỎI", "HỎI-TÔI")
                ]
                if clinician_glosses:
                    return clinician_glosses, [], None
            if retrieved["is_full"] and retrieved["entry"] is not None:
                return retrieved["gloss_sequence"], [], retrieved["entry"]
            return retrieved["gloss_sequence"], [], None

        # 4. Phân tách cụm từ dựa trên Auto-Lexicon 368 gloss + sắp xếp ngữ pháp câu hỏi VSL
        is_wh_q, is_yes_no_q = self._detect_question_type(norm)
        tokens = norm.split()
        i = 0
        glosses: List[str] = []
        missing_terms: List[str] = []

        while i < len(tokens):
            matched = False
            for span in (3, 2, 1):
                if i + span > len(tokens):
                    continue
                phrase = " ".join(tokens[i : i + span])
                if phrase in self.auto_lexicon:
                    glosses.append(self.auto_lexicon[phrase])
                    i += span
                    matched = True
                    break
            if not matched:
                tok = tokens[i]
                if tok not in VI_FUNCTION_WORDS:
                    missing_terms.append(tok)
                i += 1

        dedup: List[str] = []
        for g in glosses:
            if not dedup or dedup[-1] != g:
                dedup.append(g)

        if is_yes_no_q:
            dedup = [g for g in dedup if g not in ("CÓ", "KHÔNG", "CHƯA")]
            if "CÓ-KHÔNG" in self.gloss_clips and "CÓ-KHÔNG" not in dedup:
                dedup.append("CÓ-KHÔNG")
        elif is_wh_q or any(g in QUESTION_END_GLOSSES for g in dedup):
            tail = [g for g in dedup if g in QUESTION_END_GLOSSES]
            head = [g for g in dedup if g not in QUESTION_END_GLOSSES]
            dedup = head + tail

        return dedup, missing_terms, None

    def list_available_glosses(self) -> List[str]:
        """Trả về danh sách các gloss có dữ liệu khung xương thật để nhân viên chọn/chỉnh sửa."""
        return sorted(g for g in self.gloss_clips.keys() if g != "IX")

    def preview_gloss_plan(self, text: str) -> dict:
        """Xem trước chuỗi Gloss & từ ngoài từ điển (dùng gắn vào metadata tin nhắn)."""
        glosses, missing, full_entry = self.text_to_vsl_glosses(text)
        return {
            "mode": "full_sentence" if full_entry else ("stitched" if glosses else "text_only"),
            "matched_sample_id": full_entry["video_id"] if full_entry else None,
            "vsl_glosses": glosses,
            "missing_terms": missing,
        }

    def synthesize(
        self,
        text: str,
        override_glosses: Optional[List[str]] = None,
    ) -> dict:
        """Tạo chuỗi khung xương VSL hoàn chỉnh để phát tự động trên Kiosk."""
        if override_glosses is not None:
            glosses = [g for g in override_glosses if g in self.gloss_clips]
            missing = []
            full_entry = None
        else:
            glosses, missing, full_entry = self.text_to_vsl_glosses(text)

        if full_entry:
            arr = self._load_npy(full_entry["video_id"])
            if arr is not None and len(arr) > 0:
                return {
                    "mode": "full_sentence",
                    "video_id": full_entry["video_id"],
                    "text": text,
                    "gloss_sequence": full_entry["gloss_sequence"],
                    "missing_terms": missing,
                    "fps": 30,
                    "num_frames": int(len(arr)),
                    "gloss_frame_boundaries": full_entry["gloss_frame_boundaries"],
                    "frames": np.round(arr, 4).tolist(),
                }

        clips: List[np.ndarray] = []
        boundaries: List[dict] = []
        cursor = 0

        for g in glosses:
            info = self.gloss_clips.get(g)
            if not info:
                missing.append(g)
                continue
            vid, start, end = info
            arr = self._load_npy(vid)
            if arr is None:
                continue
            start_c = max(0, min(start, len(arr) - 1))
            end_c = max(start_c + 1, min(end, len(arr)))
            raw_clip = arr[start_c:end_c]
            aligned = self._align_clip_to_canonical(raw_clip)

            if clips:
                bridge = self._interpolate_transition(clips[-1][-1], aligned[0], steps=5)
                clips.append(bridge)
                cursor += len(bridge)

            boundaries.append({
                "gloss": g,
                "start": cursor,
                "end": cursor + len(aligned),
            })
            clips.append(aligned)
            cursor += len(aligned)

        if not clips:
            return {
                "mode": "text_only",
                "video_id": None,
                "text": text,
                "gloss_sequence": glosses,
                "missing_terms": missing,
                "fps": 30,
                "num_frames": 0,
                "gloss_frame_boundaries": [],
                "frames": [],
            }

        stitched = np.concatenate(clips, axis=0)
        return {
            "mode": "stitched",
            "video_id": f"SYNTH_{len(glosses)}_GLOSSES",
            "text": text,
            "gloss_sequence": [b["gloss"] for b in boundaries],
            "missing_terms": missing,
            "fps": 30,
            "num_frames": int(len(stitched)),
            "gloss_frame_boundaries": boundaries,
            "frames": np.round(stitched, 4).tolist(),
        }


vsl_synthesizer = VSLSynthesizer()
