from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from ocr_engine import extract_text_from_image
from rule_engine import evaluate_compliance

app = FastAPI(title="LegalLens API")

# Allow your phone to communicate with your laptop over local Wi-Fi
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, restrict this. For a hackathon, leave open.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a temporary directory to store uploaded images
UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "LegalLens Backend is Online"}

@app.post("/api/scan-label")
async def scan_label(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    # Save the uploaded file temporarily
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Step 1: Extract Text using OCR
        raw_text = extract_text_from_image(file_path)
        
        # Step 2: Run the Legal Metrology Rule Engine
        compliance_report = evaluate_compliance(raw_text)
        
        # Cleanup temp file
        os.remove(file_path)
        
        return compliance_report

    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Host on 0.0.0.0 so your phone can access it via your laptop's IPv4 address
    uvicorn.run(app, host="0.0.0.0", port=8000)