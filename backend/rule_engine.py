import re
from typing import Dict, Any, List, Optional

def extract_field(pattern: str, text: str) -> Optional[str]:
    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
    return match.group(1).strip() if match else None

def parse_mrp(text: str) -> Optional[float]:
    # Matches: MRP Rs. 150, MRP: 150.00, Rs 150, ₹150.00
    match = re.search(r'(?:MRP|M\.R\.P\.?|PRICE)?\s*(?:RS\.?|INR|₹)?\s*(\d+(?:\.\d{1,2})?)', text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None

def parse_net_quantity(text: str) -> tuple[Optional[float], Optional[str]]:
    # Matches: 500 g, 1.5 kg, 200 ml, 1 L, 750 gm
    match = re.search(r'(?:NET\s*(?:QTY|QUANTITY|WT|WEIGHT)?:?\s*)?(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|grams|l|ml|ltr|liters|pieces|pcs)\b', text, re.IGNORECASE)
    if match:
        qty = float(match.group(1))
        unit = match.group(2).lower()
        return qty, unit
    return None, None

def parse_declared_usp(text: str) -> Optional[float]:
    # Matches: USP Rs. 0.30 / ml, Unit Sale Price: Rs 0.30 per ml
    match = re.search(r'(?:USP|UNIT\s*SALE\s*PRICE)?:?\s*(?:RS\.?|INR|₹)?\s*(\d+(?:\.\d{1,4})?)\s*(?:/|per)\s*(?:g|gm|ml|kg|l|piece)', text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None

def evaluate_compliance(raw_text: str) -> Dict[str, Any]:
    violations: List[str] = []
    checklist: Dict[str, Any] = {}
    
    # 1. MRP Extraction
    mrp = parse_mrp(raw_text)
    if mrp and mrp > 0:
        checklist["mrp"] = {"status": "PASS", "value": f"₹{mrp:.2f}"}
    else:
        checklist["mrp"] = {"status": "FAIL", "value": "Not Found / Invalid"}
        violations.append("Rule 6(1)(e): Missing or illegible Maximum Retail Price (MRP).")

    # 2. Net Quantity Extraction
    net_qty, qty_unit = parse_net_quantity(raw_text)
    if net_qty and qty_unit:
        checklist["net_quantity"] = {"status": "PASS", "value": f"{net_qty} {qty_unit}"}
    else:
        checklist["net_quantity"] = {"status": "FAIL", "value": "Not Found"}
        violations.append("Rule 6(1)(f): Missing declared Net Quantity with standard metric units.")

    # 3. Unit Sale Price (USP) Mathematical Verification
    declared_usp = parse_declared_usp(raw_text)
    expected_usp = None
    usp_status = "NOT_APPLICABLE"

    if mrp and net_qty and net_qty > 0:
        expected_usp = round(mrp / net_qty, 2)
        if declared_usp is not None:
            # Allow minor rounding discrepancy (0.05 tolerance)
            if abs(declared_usp - expected_usp) <= 0.05:
                usp_status = "PASS"
                checklist["usp"] = {
                    "status": "PASS",
                    "declared": f"₹{declared_usp}",
                    "calculated": f"₹{expected_usp}/{qty_unit}",
                    "details": "Mathematical validation passed."
                }
            else:
                usp_status = "FAIL"
                checklist["usp"] = {
                    "status": "FAIL",
                    "declared": f"₹{declared_usp}",
                    "calculated": f"₹{expected_usp}/{qty_unit}",
                    "details": "Mismatch between declared and calculated unit price."
                }
                violations.append(f"G.S.R. 226(E): Unit Sale Price mismatch (Declared: ₹{declared_usp}, Expected: ₹{expected_usp}/{qty_unit}).")
        else:
            checklist["usp"] = {
                "status": "FLAGGED",
                "declared": "Missing",
                "calculated": f"₹{expected_usp}/{qty_unit}",
                "details": "Unit Sale Price declaration not found on package."
            }
            violations.append("G.S.R. 226(E): Missing mandatory Unit Sale Price (USP) declaration.")

    # 4. Dates (Mfg / Expiry / Best Before)
    date_match = re.search(r'(?:MFG|PKD|PACKED|DATE|EXP|BEST\s*BEFORE)[\s:]*([0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]{3}[,\s-]*[0-9]{2,4})', raw_text, re.IGNORECASE)
    if date_match:
        checklist["manufacturing_date"] = {"status": "PASS", "value": date_match.group(0)}
    else:
        checklist["manufacturing_date"] = {"status": "FAIL", "value": "Not Found"}
        violations.append("Rule 6(1)(d): Month and year of manufacture/packing not detected.")

    # 5. Consumer Care Contacts
    email_match = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', raw_text)
    phone_match = re.search(r'(?:toll[\s-]*free|tel|phone|contact|care)?\s*[:\s]*(\+?91[\s-]?)?[6-9]\d{9}|1800[\s-]?\d{3}[\s-]?\d{3,4}', raw_text, re.IGNORECASE)
    
    if email_match or phone_match:
        contact_val = []
        if phone_match: contact_val.append(phone_match.group(0))
        if email_match: contact_val.append(email_match.group(0))
        checklist["consumer_care"] = {"status": "PASS", "value": ", ".join(contact_val)}
    else:
        checklist["consumer_care"] = {"status": "FAIL", "value": "Not Found"}
        violations.append("Rule 6(1)(h): Missing Consumer Care contact number or email.")

    # Final Overall Verdict
    overall_status = "COMPLIANT" if len(violations) == 0 else "NON_COMPLIANT"

    return {
        "status": overall_status,
        "violations_count": len(violations),
        "violations": violations,
        "checklist": checklist,
        "raw_extracted_text": raw_text
    }