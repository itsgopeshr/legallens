import re
import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

app = FastAPI(title="LegalLens AI - Dynamic OCR Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "LegalLens OCR API"}

def compute_quality_score(cv_img: np.ndarray) -> int:
    try:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        return int(min(max((variance / 5.0), 35.0), 98.0))
    except Exception:
        return 85

def clean_ocr_text(text: str) -> str:
    """Normalizes Indian currency symbols and common OCR noise."""
    text_clean = text.replace("\n", " ").upper()
    # Tesseract often reads ₹ as ?, *, E, or Z
    text_clean = re.sub(r'[\?*€]\s*(\d+)', r'₹\1', text_clean)
    text_clean = re.sub(r'\bE(\d{2,4})\b', r'₹\1', text_clean)
    return text_clean

def analyze_label(text: str) -> Dict[str, Any]:
    text_clean = clean_ocr_text(text)

    # 1. Strict MRP Extraction (Eliminates address numbers like 7th Floor)
    mrp_val = None
    # Pattern A: Explicit MRP keyword followed by price
    mrp_match = re.search(r'(?:MRP|M\.R\.P\.?|MAX\.?\s*RETAIL\s*PRICE)\D{0,10}(?:RS\.?|₹)?\s*(\d{2,5}(?:\.\d{1,2})?)', text_clean)
    if mrp_match:
        mrp_val = float(mrp_match.group(1))
    else:
        # Pattern B: Explicit Rupee/Rs symbol followed by price
        mrp_match = re.search(r'(?:₹|RS\.?)\s*[:=.]?\s*(\d{2,5}(?:\.\d{1,2})?)', text_clean)
        if mrp_match:
            mrp_val = float(mrp_match.group(1))
        else:
            # Pattern C: Price followed by /- format (e.g. 99/-)
            mrp_match = re.search(r'\b(\d{2,5})\s*/-', text_clean)
            if mrp_match:
                mrp_val = float(mrp_match.group(1))

    # 2. Net Quantity Extraction (Catches both 'Net 200ml' and '200ml Net')
    net_qty_val = None
    net_qty_unit = None
    qty_match = re.search(r'(?:NET\s*(?:WT|QTY|VOL|VOLUME)?[:.]?\s*)(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\b', text_clean)
    if not qty_match:
        qty_match = re.search(r'[\^#]?\s*(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\s*(?:NET|VOL|QTY)?\b', text_clean)
    if not qty_match:
        qty_match = re.search(r'\b(\d{2,4})\s*(ML|G|GM)\b', text_clean)

    if qty_match:
        net_qty_val = float(qty_match.group(1))
        net_qty_unit = qty_match.group(2).lower()
        if net_qty_unit in ['gm', 'gms']:
            net_qty_unit = 'g'

    # 3. Unit Sale Price (USP) under G.S.R. 226(E)
    calculated_usp = None
    expected_usp_str = None
    if mrp_val and net_qty_val and net_qty_val > 0:
        base_unit = "g" if "g" in (net_qty_unit or "") else "ml"
        calculated_usp = mrp_val / net_qty_val
        expected_usp_str = f"₹{round(calculated_usp, 2)}/{base_unit}"

    # Declared USP: Catches "USP ₹0.50/ml", "@ 0.50/ml", or raw "₹0.50/ml"
    declared_usp_str = None
    declared_val = None
    usp_match = re.search(r'(?:USP|U\.S\.P\.?|@)?\s*[:=]?\s*(?:RS\.?|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:/|PER)\s*(G|ML|KG|L)', text_clean)
    if usp_match:
        declared_val = float(usp_match.group(1))
        declared_usp_str = f"₹{declared_val:.2f}/{usp_match.group(2).lower()}"

    # 4. Manufacturing / Expiry / Batch Code
    mfg_date = None
    # Look for standard date patterns (e.g., 05/25, 05/2025, 23/05/25)
    date_match = re.search(r'\b(0[1-9]|1[0-2])[/-](\d{2,4})\b', text_clean)
    if date_match:
        mfg_date = date_match.group(0)
    else:
        batch_match = re.search(r'\b(BSTN\w+|LOT\w+|B\.\s*NO\w*)\b', text_clean)
        if batch_match:
            mfg_date = batch_match.group(0)

    # 5. Consumer Care Details
    care_match = re.search(r'(?:CONSUMER|CARE|FEEDBACK|HELPLINE|TOLL\s*FREE|1800|RECKITT|ZYDUS|@|\.COM)', text_clean)

    # 6. Category Auto-Detection
    cosmetic_keywords = ['AQUA', 'SULFATE', 'PARFUM', 'EXTERNAL USE', 'SHAMPOO', 'SOAP', 'LOTION', 'HANDWASH']
    food_keywords = ['SUGAR', 'CARBOHYDRATE', 'PROTEIN', 'FAT', 'KCAL', 'ENERGY', 'INGREDIENTS', 'FSSAI', 'SUCROSE', 'DEXTROSE']

    category = "general"
    if any(k in text_clean for k in cosmetic_keywords):
        category = "cosmetic"
    elif any(k in text_clean for k in food_keywords):
        category = "food"

    # 7. Statutory Violations Audit
    violations = []
    if not mrp_val:
        violations.append("Rule 6(1)(e): Maximum Retail Price (MRP) missing or illegible.")
    if not net_qty_val:
        violations.append("Rule 6(1)(b): Standard Net Quantity declaration missing.")
    if mrp_val and net_qty_val:
        if not declared_usp_str:
            violations.append(f"G.S.R. 226(E): Unit Sale Price not explicitly stated (Computed: {expected_usp_str}).")
        elif declared_val and abs(declared_val - calculated_usp) > 0.06:
            violations.append(f"G.S.R. 226(E): USP mismatch (Declared: {declared_usp_str}, True: {expected_usp_str}).")

    if not mfg_date:
        violations.append("Rule 6(1)(d): Month/Year of packing or Batch No. not detected.")
    if not care_match:
        violations.append("Rule 6(2): Consumer care contact channel not found.")

    if category == "cosmetic" and "EXTERNAL USE" not in text_clean:
        violations.append("D&C Rules: Caution 'For External Use Only' declaration requires verification.")

    return {
        "status": "COMPLIANT" if len(violations) == 0 else "NON-COMPLIANT",
        "category": category,
        "violations": violations,
        "checklist": {
            "mrp": {
                "value": f"₹{mrp_val:.2f}" if mrp_val else "Missing",
                "status": "PASS" if mrp_val else "FAIL"
            },
            "net_quantity": {
                "value": f"{net_qty_val} {net_qty_unit}" if net_qty_val else "Missing",
                "status": "PASS" if net_qty_val else "FAIL"
            },
            "usp": {
                "declared": declared_usp_str or "Missing",
                "calculated": expected_usp_str or "N/A",
                "status": "PASS" if declared_usp_str and (not calculated_usp or abs((declared_val or 0) - calculated_usp) <= 0.06) else "FAIL"
            },
            "manufacturing_date": {
                "value": mfg_date or "Missing",
                "status": "PASS" if mfg_date else "FAIL"
            }
        },
        "raw_text": text
    }

@app.post("/api/scan-label")
async def scan_label(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if cv_img is None:
            return {"status": "NON-COMPLIANT", "violations": ["Invalid image file payload"], "raw_text": ""}

        quality_score = compute_quality_score(cv_img)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        # Enhance resolution for small fine print (up to 1600px width)
        h, w = gray.shape[:2]
        if w > 1600:
            scale = 1600 / w
            gray = cv2.resize(gray, (1600, int(h * scale)))

        # Pass 1: Standard contrast enhancement (for black text on light bottle)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        norm_enhanced = clahe.apply(gray)
        text_standard = pytesseract.image_to_string(norm_enhanced)

        # Pass 2: COLOR INVERSION (Crucial: turns white text on dark green banner into black text on white)
        inverted = cv2.bitwise_not(norm_enhanced)
        text_inverted = pytesseract.image_to_string(inverted)

        # Combine both optical passes
        combined_text = f"{text_standard} | {text_inverted}"

        report = analyze_label(combined_text)
        report["optical_score"] = quality_score
        return report

    except Exception as e:
        return {
            "status": "NON-COMPLIANT",
            "category": "general",
            "violations": [f"Processing exception: {str(e)}"],
            "checklist": {
                "mrp": {"value": "Missing", "status": "FAIL"},
                "net_quantity": {"value": "Missing", "status": "FAIL"},
                "usp": {"declared": "Missing", "calculated": "N/A", "status": "FAIL"},
                "manufacturing_date": {"value": "Missing", "status": "FAIL"}
            },
            "raw_text": str(e),
            "optical_score": 75
        }
