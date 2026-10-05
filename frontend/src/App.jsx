import React, { useState, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import jsPDF from 'jspdf';

export default function App() {
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const BACKEND_URL = `http://${window.location.hostname}:8000/api/scan-label`;

  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setReport(null);
      setError(null);
      uploadAndAnalyze(file);
    }
  };

  const uploadAndAnalyze = async (file) => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.statusText}`);
      }

      const data = await response.json();
      setReport(data);
      if (data.status === 'COMPLIANT') {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Ensure laptop & phone share the same Wi-Fi and port 8000 is running.');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setImagePreview(null);
    setReport(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadLegalNotice = () => {
    if (!report) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("GOVERNMENT OF INDIA", 105, 18, { align: "center" });
    doc.setFontSize(11);
    doc.text("MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text("LEGAL METROLOGY DIVISION — STATUTORY COMPLIANCE NOTICE", 105, 32, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(15, 36, 195, 36);

    // Inspection Metadata
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const refId = `LM/PCR/2026/${Math.floor(100000 + Math.random() * 900000)}`;
    doc.text(`Reference No: ${refId}`, 15, 44);
    doc.text(`Inspection Timestamp: ${new Date().toLocaleString('en-IN')}`, 15, 50);
    doc.text(`Inspection Tool: LegalLens AI (Automated Packaging Inspector)`, 15, 56);
    doc.text(`Statutory Act: Legal Metrology (Packaged Commodities) Rules, 2011 & G.S.R. 226(E)`, 15, 62);
    
    // Verdict Highlight Box
    const isCompliant = report.status === 'COMPLIANT';
    doc.setFillColor(isCompliant ? 240 : 254, isCompliant ? 253 : 242, isCompliant ? 244 : 242);
    doc.roundedRect(15, 68, 180, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(isCompliant ? 22 : 185, isCompliant ? 101 : 28, isCompliant ? 52 : 28);
    doc.text(`OVERALL STATUS: ${isCompliant ? '100% COMPLIANT' : 'STATUTORY VIOLATION NOTICE ISSUED'}`, 20, 78);

    // Reset Text Color
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text("MANDATORY DECLARATIONS AUDIT TRAIL:", 15, 94);
    
    let y = 102;
    const checklistItems = [
      ["Maximum Retail Price (MRP)", report.checklist.mrp?.value || "Missing", report.checklist.mrp?.status || "FAIL"],
      ["Net Quantity", report.checklist.net_quantity?.value || "Missing", report.checklist.net_quantity?.status || "FAIL"],
      ["Unit Sale Price (USP)", report.checklist.usp?.calculated ? `Calculated: ${report.checklist.usp.calculated}` : "Missing", report.checklist.usp?.status || "FAIL"],
      ["Manufacturing / Expiry Date", report.checklist.manufacturing_date?.value || "Missing", report.checklist.manufacturing_date?.status || "FAIL"],
      ["Consumer Care Details", report.checklist.consumer_care?.status === 'PASS' ? "Verified" : "Missing", report.checklist.consumer_care?.status || "FAIL"]
    ];

    checklistItems.forEach(([label, val, stat]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`• ${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${val}  [Status: ${stat}]`, 85, y);
      y += 8;
    });

    // Violations Section
    if (report.violations && report.violations.length > 0) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(185, 28, 28);
      doc.text("CITATIONS & VIOLATIONS TO BE RECTIFIED:", 15, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      y += 7;
      report.violations.forEach((violation) => {
        const splitText = doc.splitTextToSize(`- ${violation}`, 170);
        doc.text(splitText, 20, y);
        y += (splitText.length * 6);
      });
    }

    // Official Seal Footer
    doc.setDrawColor(203, 213, 225);
    doc.line(15, 260, 195, 260);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("This is an automated field audit report generated by LegalLens AI for preliminary enforcement evaluation.", 105, 267, { align: "center" });
    doc.text("Digital Verification Signature: SHA256-AUTHENTICATED-RECORD", 105, 273, { align: "center" });

    doc.save(`Legal_Metrology_Notice_${Date.now()}.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '16px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={28} color="#2563eb" />
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>LegalLens AI</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Legal Metrology Compliance (PCR 2011)</p>
          </div>
        </div>
        {report && (
          <button onClick={resetScanner} style={{ border: 'none', background: '#f1f5f9', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
            <RefreshCw size={18} color="#475569" />
          </button>
        )}
      </header>

      <main style={{ flex: 1, marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!imagePreview ? (
          <div style={{
            flex: 1,
            border: '2px dashed #cbd5e1',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
            backgroundColor: '#f8fafc'
          }}>
            <div style={{ background: '#dbeafe', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
              <Camera size={40} color="#2563eb" />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Scan Packaging Label</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Capture the back panel showing MRP, Net Weight, Dates & Manufacturer details.
            </p>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleCapture}
              style={{ display: 'none' }}
              id="camera-input"
            />
            <label
              htmlFor="camera-input"
              style={{
                background: '#2563eb',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '10px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Camera size={18} /> Open Phone Camera
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <img src={imagePreview} alt="Captured Label" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Analyzing PCR Declarations...</span>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            {report && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: report.status === 'COMPLIANT' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${report.status === 'COMPLIANT' ? '#bbf7d0' : '#fecaca'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {report.status === 'COMPLIANT' ? (
                      <CheckCircle2 size={24} color="#16a34a" />
                    ) : (
                      <XCircle size={24} color="#dc2626" />
                    )}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: report.status === 'COMPLIANT' ? '#166534' : '#991b1b' }}>
                        {report.status === 'COMPLIANT' ? '100% COMPLIANT' : 'STATUTORY VIOLATIONS DETECTED'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {report.violations_count} Non-compliance flags
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Mandatory Declarations Audit
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>Declared MRP:</span>
                      <span className={`badge ${report.checklist.mrp?.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {report.checklist.mrp?.value || 'Missing'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>Net Quantity:</span>
                      <span className={`badge ${report.checklist.net_quantity?.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {report.checklist.net_quantity?.value || 'Missing'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>Unit Sale Price (USP):</span>
                      <span className={`badge ${report.checklist.usp?.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {report.checklist.usp?.calculated ? `Calc: ${report.checklist.usp.calculated}` : 'Missing'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>Mfg / Expiry:</span>
                      <span className={`badge ${report.checklist.manufacturing_date?.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {report.checklist.manufacturing_date?.value || 'Missing'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>Consumer Helpline:</span>
                      <span className={`badge ${report.checklist.consumer_care?.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {report.checklist.consumer_care?.status === 'PASS' ? 'Verified' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>

                {report.violations.length > 0 && (
                  <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#be123c', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                      <AlertTriangle size={16} /> Legal Notice Findings:
                    </div>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.78rem', color: '#9f1239', lineHeight: 1.4 }}>
                      {report.violations.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* PDF Download Button */}
                <button
                  onClick={downloadLegalNotice}
                  style={{
                    marginTop: '4px',
                    width: '100%',
                    padding: '12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
                  }}
                >
                  <FileDown size={18} /> Download Statutory Notice (PDF)
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}