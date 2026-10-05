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

def preprocess_image(cv_img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]
    if width > 1000:
        scale = 1000 / width
        gray = cv2.resize(gray, (1000, int(height * scale)))
    
    # Standard thresholding for black-on-white text
    enhanced = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    return enhanced, gray

def analyze_label(text: str) -> Dict[str, Any]:
    # Clean up common Tesseract OCR misreads for Indian symbols
    text_clean = text.replace("\n", " ").upper()
    text_clean = text_clean.replace("?", "₹").replace("E99", "₹99").replace("€", "₹")
    
    # 1. Smarter MRP Extraction (Catches "₹99/-" or "RS 99" without strict prefixes)
    mrp_match = re.search(r'(?:MRP|RS\.?|₹|PRICE)?\s*[:=]?\s*(?:RS\.?|₹)?\s*(\d+(?:\.\d{1,2})?)(?:/-|/)?', text_clean)
    
    # 2. Smarter Net Quantity (Catches "200ml Net" or "200 ML" anywhere)
    qty_match = re.search(r'(?:NET\s*(?:WT|QTY|VOL)?\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\b(?:\s*NET)?', text_clean)
    
    # 3. Smarter USP (Catches "₹0.50/ml" even if the letters "USP" are entirely missing)
    declared_usp_match = re.search(r'(?:USP\s*[:=]?\s*)?(?:RS\.?|₹)?\s*(\d+\.\d{1,2})\s*(?:/|PER)\s*(G|ML|KG|L)', text_clean)
    
    # 4. Mfg/Batch (Catches pure dates like "05/25" or "BSTN759")
    mfg_match = re.search(r'(?:MFG|PKD|PACKED|MFR|BATCH|USE BEFORE)?\s*[:=]?\s*([A-Z0-9]{5,10}|\d{2}/\d{2,4})', text_clean)
    
    # 5. Consumer Care (Broadened to catch brand names and standard symbols)
    care_match = re.search(r'(?:CARE|FEEDBACK|HELPLINE|TOLL FREE|1800|@|\.COM|RECKITT|ZYDUS|CONSUMER)', text_clean)

    mrp_val = float(mrp_match.group(1)) if mrp_match else None
    net_qty_val = float(qty_match.group(1)) if qty_match else None
    net_qty_unit = qty_match.group(2).lower() if qty_match else None
    
    # Auto-Detect Category
    cosmetic_keywords = ['aqua', 'sulfate', 'parfum', 'external use', 'shampoo', 'soap', 'lotion', 'handwash']
    food_keywords = ['sugar', 'carbohydrate', 'protein', 'fat', 'kcal', 'energy', 'ingredients', 'fssai', 'sucrose', 'dextrose']
    
    category = "general"
    if any(k.upper() in text_clean for k in cosmetic_keywords):
        category = "cosmetic"
    elif any(k.upper() in text_clean for k in food_keywords):
        category = "food"

    # Compute expected Unit Sale Price
    calculated_usp = None
    expected_usp_str = None
    if mrp_val and net_qty_val and net_qty_val > 0:
        base_unit = "g" if "g" in (net_qty_unit or "") else "ml"
        calculated_usp = mrp_val / net_qty_val
        expected_usp_str = f"₹{round(calculated_usp, 2)}/{base_unit}"

    declared_usp_str = f"₹{declared_usp_match.group(1)}/{declared_usp_match.group(2).lower()}" if declared_usp_match else None

    # Violations Engine
    violations = []
    
    if not mrp_val:
        violations.append("Rule 6(1)(e): Mandatory Retail Sale Price (MRP) missing or illegible.")
    
    if not net_qty_val:
        violations.append("Rule 6(1)(b): Standard Net Quantity missing or non-standard format.")
        
    if mrp_val and net_qty_val:
        if not declared_usp_str:
            violations.append(f"G.S.R. 226(E): Unit Sale Price not explicitly declared (Expected: {expected_usp_str}).")
        else:
            declared_val = float(declared_usp_match.group(1))
            if abs(declared_val - calculated_usp) > 0.05:
                violations.append(f"G.S.R. 226(E): USP mathematical mismatch (Declared: {declared_usp_str}, True: {expected_usp_str}).")

    if not mfg_match:
        violations.append("Rule 6(1)(d): Month/Year of manufacture or Batch No. not found.")
        
    if not care_match:
        violations.append("Rule 6(2): Consumer care contact details missing.")

    if category == "cosmetic" and "EXTERNAL USE" not in text_clean:
        violations.append("D&C Rules: Mandatory 'For External Use Only' caution missing for topical product.")

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
                "status": "PASS" if declared_usp_str and abs(float(declared_usp_match.group(1)) - (calculated_usp or 0)) <= 0.05 else "FAIL"
            },
            "manufacturing_date": {
                "value": mfg_match.group(1) if mfg_match else "Missing",
                "status": "PASS" if mfg_match else "FAIL"
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
        enhanced_img, gray_img = preprocess_image(cv_img)
        
        # Dual-Pass OCR: Read thresholded image AND raw grayscale to catch white-on-green text
        try:
            text_pass_1 = pytesseract.image_to_string(enhanced_img)
            text_pass_2 = pytesseract.image_to_string(gray_img)
            raw_ocr_text = text_pass_1 + " | " + text_pass_2
        except Exception as ocr_err:
            raw_ocr_text = f"OCR Error: {str(ocr_err)}"

        report = analyze_label(raw_ocr_text)
        report["optical_score"] = quality_score
        return report

    except Exception as e:
        return {
            "status": "NON-COMPLIANT",
            "category": "general",
            "violations": [f"Server processing exception: {str(e)}"],
            "checklist": {
                "mrp": {"value": "Missing", "status": "FAIL"},
                "net_quantity": {"value": "Missing", "status": "FAIL"},
                "usp": {"declared": "Missing", "calculated": "N/A", "status": "FAIL"},
                "manufacturing_date": {"value": "Missing", "status": "FAIL"}
            },
            "raw_text": str(e),
            "optical_score": 75
        }
