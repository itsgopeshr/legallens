import re
import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from duckduckgo_search import DDGS

app = FastAPI(title="LegalLens AI - Dynamic OCR & Web Crawler")

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
    return {"status": "ok", "service": "LegalLens OCR & Crawler API"}

def compute_quality_score(cv_img: np.ndarray) -> int:
    try:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        return int(min(max((variance / 5.0), 35.0), 98.0))
    except Exception:
        return 85

def fetch_live_web_data(ocr_text: str):
    """Crawls the real internet based on scanned packaging text."""
    try:
        # 1. Filter out common packaging words to find the actual product/brand name
        stopwords = ['INGREDIENTS', 'AQUA', 'SULFATE', 'MRP', 'NET', 'QTY', 'VOL', 'USE', 'BEFORE', 'BATCH', 'MFG', 'RS', 'PRICE', 'CONSUMER', 'CARE', 'LTD', 'PVT', 'INDIA']
        words = re.findall(r'\b[A-Za-z]{4,}\b', ocr_text.upper())
        
        keywords = []
        for w in words:
            if w not in stopwords and len(w) > 3:
                keywords.append(w)
        
        # Take the top 4 unique meaningful words as our search query
        unique_keywords = list(dict.fromkeys(keywords))[:4]
        query = " ".join(unique_keywords) + " product details ingredients"
        
        if len(unique_keywords) < 2:
            return [{"title": "Insufficient Data", "body": "Could not extract enough brand keywords to perform a reliable web search.", "link": ""}]

        # 2. Perform Real Live Web Search
        results = []
        with DDGS() as ddgs:
            # Fetch top 3 real web snippets
            for r in ddgs.text(query, max_results=3):
                results.append({
                    "title": r.get('title', 'Unknown Title'),
                    "body": r.get('body', ''),
                    "link": r.get('href', '#')
                })
        return results
    except Exception as e:
        return [{"title": "Web Search Failed", "body": f"Crawler error: {str(e)}", "link": ""}]

def analyze_label(text: str) -> Dict[str, Any]:
    text_clean = text.replace("\n", " ").upper()
    text_clean = re.sub(r'[\?*€]\s*(\d+)', r'₹\1', text_clean)
    text_clean = re.sub(r'\bE(\d{2,4})\b', r'₹\1', text_clean)

    # Regex Extractions
    mrp_val = None
    mrp_match = re.search(r'(?:MRP|M\.R\.P\.?|MAX\.?\s*RETAIL\s*PRICE)\D{0,10}(?:RS\.?|₹)?\s*(\d{2,5}(?:\.\d{1,2})?)', text_clean)
    if not mrp_match:
        mrp_match = re.search(r'(?:₹|RS\.?)\s*[:=.]?\s*(\d{2,5}(?:\.\d{1,2})?)', text_clean)
    if mrp_match: mrp_val = float(mrp_match.group(1))

    net_qty_val = None
    net_qty_unit = None
    qty_match = re.search(r'(?:NET\s*(?:WT|QTY|VOL|VOLUME)?[:.]?\s*)(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\b', text_clean)
    if not qty_match:
        qty_match = re.search(r'[\^#]?\s*(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\s*(?:NET|VOL|QTY)?\b', text_clean)
    
    if qty_match:
        net_qty_val = float(qty_match.group(1))
        net_qty_unit = qty_match.group(2).lower()

    mfg_date = None
    date_match = re.search(r'\b(0[1-9]|1[0-2])[/-](\d{2,4})\b', text_clean)
    if date_match: mfg_date = date_match.group(0)

    # Categories
    category = "general"
    if any(k in text_clean for k in ['AQUA', 'SULFATE', 'PARFUM', 'EXTERNAL USE', 'HANDWASH']):
        category = "cosmetic"
    elif any(k in text_clean for k in ['SUGAR', 'KCAL', 'ENERGY', 'FSSAI', 'SUCROSE', 'DEXTROSE']):
        category = "food"

    # Start Live Web Crawl
    web_data = fetch_live_web_data(text_clean)

    return {
        "status": "COMPLIANT" if mrp_val and net_qty_val else "NON-COMPLIANT",
        "category": category,
        "violations": [] if mrp_val else ["Mandatory declarations missing. Consult Web Data tab."],
        "checklist": {
            "mrp": {"value": f"₹{mrp_val:.2f}" if mrp_val else "Missing", "status": "PASS" if mrp_val else "FAIL"},
            "net_quantity": {"value": f"{net_qty_val} {net_qty_unit}" if net_qty_val else "Missing", "status": "PASS" if net_qty_val else "FAIL"},
            "manufacturing_date": {"value": mfg_date or "Missing", "status": "PASS" if mfg_date else "FAIL"}
        },
        "raw_text": text,
        "web_intelligence": web_data
    }

@app.post("/api/scan-label")
async def scan_label(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        quality_score = compute_quality_score(cv_img)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        h, w = gray.shape[:2]
        if w > 1600:
            gray = cv2.resize(gray, (1600, int(h * (1600 / w))))

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        norm_enhanced = clahe.apply(gray)
        text_standard = pytesseract.image_to_string(norm_enhanced)
        
        inverted = cv2.bitwise_not(norm_enhanced)
        text_inverted = pytesseract.image_to_string(inverted)

        combined_text = f"{text_standard} | {text_inverted}"

        report = analyze_label(combined_text)
        report["optical_score"] = quality_score
        return report

    except Exception as e:
        return {"status": "NON-COMPLIANT", "raw_text": str(e), "optical_score": 0, "web_intelligence": [], "checklist": {}}
        
