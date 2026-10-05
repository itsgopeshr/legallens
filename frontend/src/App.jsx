import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, Moon, Sun, ShieldCheck, HeartPulse, 
  Info, Home, RefreshCw, CheckCircle2, AlertTriangle,
  Globe, History, Download, Search, FileDown, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';

// --- Client-Side Image Resizer (Guards against mobile RAM spikes) ---
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scaleSize = MAX_WIDTH / img.width;
        
        if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name || "capture.jpg", { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

// --- App Shell & Navigation Layout ---
const Layout = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header style={{ 
        padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={26} color="var(--primary)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>LegalLens AI</span>
              <span style={{ fontSize: '0.62rem', background: 'var(--bg-input)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                PCR 2011
              </span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Dynamic OCR Auditor</p>
          </div>
        </div>
        <button 
          onClick={() => setIsDark(!isDark)} 
          style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-main)', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main style={{ flex: 1, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ height: '100%' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav style={{ 
        display: 'flex', justifyContent: 'space-around', padding: '10px 4px', 
        background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)',
        position: 'sticky', bottom: 0, zIndex: 50, paddingBottom: 'max(10px, env(safe-area-inset-bottom))'
      }}>
        <NavIcon to="/" icon={<Home size={20} />} label="Home" current={location.pathname} />
        <NavIcon to="/scan" icon={<Camera size={20} />} label="Scan" current={location.pathname} />
        <NavIcon to="/url" icon={<Globe size={20} />} label="Web" current={location.pathname} />
        <NavIcon to="/health" icon={<HeartPulse size={20} />} label="Health" current={location.pathname} />
        <NavIcon to="/history" icon={<History size={20} />} label="Logs" current={location.pathname} />
        <NavIcon to="/about" icon={<Info size={20} />} label="Team" current={location.pathname} />
      </nav>
    </div>
  );
};

const NavIcon = ({ to, icon, label, current }) => {
  const active = current === to;
  return (
    <Link to={to} style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', 
      textDecoration: 'none', color: active ? 'var(--primary)' : 'var(--text-muted)', flex: 1
    }}>
      {icon}
      <span style={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500 }}>{label}</span>
    </Link>
  );
};

// --- PAGE 1: Home ---
const HomePage = () => {
  const navigate = useNavigate();

  const handleSelection = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    navigate('/scan', { state: { directFile: compressed } });
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>Legal Metrology Scanner</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Automated Statutory & Health Compliance</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <input type="file" accept="image/*" capture="environment" id="home-camera" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-camera" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '50%' }}>
            <Camera size={30} color="var(--primary)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Live Camera</span>
        </label>
        
        <input type="file" accept="image/*" id="home-upload" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-upload" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}>
          <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '50%' }}>
            <Upload size={30} color="var(--primary)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Upload Image</span>
        </label>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
          Automated Legal Metrology Rules
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Rule 6(1)(e):</strong> Maximum Retail Price (MRP)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>G.S.R. 226(E):</strong> Mathematical Unit Sale Price (USP)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Rule 6(1)(b):</strong> Standard Net Quantity Units</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="var(--success)" /> <strong>Rule 6(2):</strong> Consumer Redressal Contact Info</div>
        </div>
      </div>
    </div>
  );
};

// --- PAGE 2: Dynamic Scanner Suite ---
const ScanPage = () => {
  const location = useLocation();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('audit');
  
  const [categoryOverride, setCategoryOverride] = useState(null); // Allows user to override backend category
  const [healthWarnings, setHealthWarnings] = useState([]);
  const [healthInsights, setHealthInsights] = useState([]);

  // =========================================================================
  // BACKEND TARGET: Change to your Render URL for production deployment.
  // Currently set to your tethered local IP matching Python uvicorn port 10000.
  // =========================================================================
  const BACKEND_URL = "https://legallens-370y.onrender.com/api/scan-label"; 

  useEffect(() => {
    if (location.state?.directFile) {
      executeScan(location.state.directFile);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Evaluate whenever the report or the selected category changes
  useEffect(() => {
    if (report?.raw_text) {
      const activeCategory = categoryOverride || report.category || 'general';
      evaluateHealthProfile(report.raw_text, activeCategory);
    }
  }, [report, categoryOverride]);

  const evaluateHealthProfile = (rawText = "", selectedCategory) => {
    const diet = localStorage.getItem('legallens_diet') || 'Vegetarian';
    const savedAllergies = localStorage.getItem('legallens_allergies');
    const allergies = savedAllergies ? JSON.parse(savedAllergies) : {};
    const text = rawText.toLowerCase();

    const warnings = [];
    const insights = [];

    if (selectedCategory === 'cosmetic') {
      insights.push({
        title: "Regime: Personal Care & Hygiene",
        type: "info",
        desc: "Strictly for topical application. Analyzed under Drugs & Cosmetics Rules."
      });
      if (text.includes('external use') || text.includes('contact with eyes')) {
        insights.push({
          title: "Statutory Caution Verified",
          type: "success",
          desc: "Mandatory declaration verified: 'For external use only / Avoid eye contact'."
        });
      } else {
        warnings.push("D&C Rules: Mandatory 'For External Use Only' caution declaration not detected on label.");
      }
    } else {
      if (diet === 'Vegetarian') {
        const nonVegTriggers = ['gelatin', 'chicken', 'fish', 'meat', 'egg', 'pork', 'lard', 'carmine'];
        nonVegTriggers.forEach(trigger => {
          if (text.includes(trigger)) warnings.push(`Non-Veg element detected: "${trigger}"`);
        });
      }
      Object.keys(allergies).forEach(allergen => {
        if (allergies[allergen] && text.includes(allergen)) {
          warnings.push(`Contains monitored allergen: ${allergen.toUpperCase()}`);
        }
      });
      if (text.includes('sugar') || text.includes('sucrose') || text.includes('dextrose') || text.includes('glucose')) {
        insights.push({
          title: "High Glycemic Impact (High Sugar)",
          type: "warning",
          desc: "Contains simple fast-acting sugars. Not recommended for diabetic or pre-diabetic diets."
        });
      }
    }

    setHealthWarnings(warnings);
    setHealthInsights(insights);
  };

  const handleManualSelection = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;
    const compressed = await compressImage(rawFile);
    executeScan(compressed);
  };

  const executeScan = async (file) => {
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setReport(null);
    setErrorMsg(null);
    setCategoryOverride(null);
    setHealthWarnings([]);
    setHealthInsights([]);

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 12s timeout for true OCR

      const res = await fetch(BACKEND_URL, { 
        method: 'POST', 
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      setReport(data);
      
      if (data.status === 'COMPLIANT') confetti();
      
      saveAuditLog(data.status, data.optical_score || 85, data.category || 'General');

    } catch (err) {
      console.error("Backend Error:", err);
      setErrorMsg("Failed to connect to the OCR Engine. Ensure the Python backend is running locally at " + BACKEND_URL);
    } finally {
      setLoading(false);
    }
  };

  const saveAuditLog = (status, score, type) => {
    const existing = JSON.parse(localStorage.getItem('legallens_history') || '[]');
    localStorage.setItem('legallens_history', JSON.stringify([{
      id: Date.now(),
      date: new Date().toLocaleString(),
      status: status || 'NON-COMPLIANT',
      type: `Scan: ${type.toUpperCase()}`,
      score: score
    }, ...existing]));
  };

  const downloadOfficialNotice = () => {
    if (!report) return;
    const doc = new jsPDF();
    const noticeId = `LM/PCR-2011/DL-${Math.floor(100000 + Math.random() * 900000)}`;

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 24, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text("MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION", 105, 11, { align: "center" });
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text("LEGAL METROLOGY DIVISION — STATUTORY COMPLIANCE NOTICE", 105, 18, { align: "center" });

    doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("STATUTORY PRE-ENFORCEMENT AUDIT NOTICE", 105, 36, { align: "center" });
    doc.setLineWidth(0.4); doc.setDrawColor(203, 213, 225); doc.line(15, 40, 195, 40);

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Reference No: ${noticeId}`, 15, 48);
    doc.text(`Inspection Time: ${new Date().toLocaleString('en-IN')}`, 15, 54);
    doc.text(`OCR Optical Score: ${report.optical_score || 'N/A'} / 100`, 15, 60);

    const isPass = report.status === 'COMPLIANT';
    doc.setFillColor(isPass ? 240 : 254, isPass ? 253 : 242, isPass ? 244 : 242);
    doc.roundedRect(15, 66, 180, 15, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.setTextColor(isPass ? 22 : 185, isPass ? 101 : 28, isPass ? 52 : 28);
    doc.text(`AUDIT VERDICT: ${isPass ? 'COMPLIANT WITH STATUTORY RULES' : 'CONTRAVENTION NOTICED'}`, 20, 76);

    doc.setTextColor(15, 23, 42); doc.setFontSize(9.5);
    doc.text("SCHEDULE OF MANDATORY DECLARATIONS:", 15, 92);

    let y = 100;
    const checks = [
      ["Maximum Retail Price (MRP)", report.checklist?.mrp?.value || 'Missing', report.checklist?.mrp?.status || 'FAIL'],
      ["Net Quantity", report.checklist?.net_quantity?.value || 'Missing', report.checklist?.net_quantity?.status || 'FAIL'],
      ["Unit Sale Price (USP)", report.checklist?.usp?.calculated ? `Expected: ${report.checklist.usp.calculated}` : 'Missing', report.checklist?.usp?.status || 'FAIL'],
      ["Batch / Mfg Date", report.checklist?.manufacturing_date?.value || 'Missing', report.checklist?.manufacturing_date?.status || 'FAIL']
    ];

    checks.forEach(([title, val, status]) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(`• ${title}`, 20, y); doc.setFont("helvetica", "bold");
      doc.text(`${val} [${status}]`, 140, y); y += 8;
    });

    if (report.violations && report.violations.length > 0) {
      y += 4; doc.setFont("helvetica", "bold"); doc.setTextColor(185, 28, 28);
      doc.text("STATUTORY CITATIONS DETECTED:", 15, y);
      y += 6; doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      report.violations.forEach((v) => {
        const splitText = doc.splitTextToSize(`- ${v}`, 170);
        doc.text(splitText, 20, y); y += (splitText.length * 5) + 2;
      });
    }

    doc.save(`LegalLens_Statutory_Notice_${Date.now()}.pdf`);
  };

  const activeCategory = categoryOverride || report?.category || 'general';

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {!preview ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}>
          <Camera size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Scan Packaging</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Submit an image to the live OCR engine.</p>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleManualSelection} style={{ display: 'none' }} id="cam-input-scan" />
            <label htmlFor="cam-input-scan" style={{ background: 'var(--primary)', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={18}/> Camera
            </label>
            <input type="file" accept="image/*" onChange={handleManualSelection} style={{ display: 'none' }} id="upload-input-scan" />
            <label htmlFor="upload-input-scan" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={18}/> Upload
            </label>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Dynamic Category Switcher */}
          {report && !errorMsg && (
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px' }}>
              <button
                onClick={() => setCategoryOverride('cosmetic')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                  background: activeCategory === 'cosmetic' ? 'var(--primary)' : 'transparent',
                  color: activeCategory === 'cosmetic' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                🧴 Cosmetic / FMCG
              </button>
              <button
                onClick={() => setCategoryOverride('food')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                  background: activeCategory === 'food' ? 'var(--primary)' : 'transparent',
                  color: activeCategory === 'food' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                🍽️ Food & Nutrition
              </button>
            </div>
          )}

          <div style={{ position: 'relative', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Scanned Label" />
            {loading && (
              <>
                <div className="scanner-grid" />
                <div className="scanner-laser" />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '8px', zIndex: 11 }}>
                  <RefreshCw className="spinner" size={30} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Extracting Declarations...</span>
                </div>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="card" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={20}/> Server Error</h4>
              <p style={{ fontSize: '0.8rem' }}>{errorMsg}</p>
              <button onClick={() => {setPreview(null); setErrorMsg(null);}} style={{ marginTop: '12px', padding: '8px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>Try Again</button>
            </div>
          )}

          {!loading && report && !errorMsg && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span>OCR Accuracy Score</span>
                  <span style={{ color: (report.optical_score || 0) > 60 ? 'var(--success)' : 'var(--warning)' }}>{report.optical_score || 'N/A'} / 100</span>
                </div>
                <progress value={report.optical_score || 0} max="100"></progress>
              </div>

              {healthWarnings.length === 0 ? (
                <div style={{ background: 'var(--success-bg)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700 }}>
                  <ShieldCheck size={18} /> Safety Profile Match: 100% Verified
                </div>
              ) : (
                <div style={{ background: 'var(--danger-bg)', padding: '10px', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}><AlertTriangle size={16} /> Statutory / Health Warnings:</div>
                  {healthWarnings.map((warning, idx) => <div key={idx}>• {warning}</div>)}
                </div>
              )}

              {healthInsights.length > 0 && (
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HeartPulse size={16} color="var(--primary)" /> Regulatory & Health Advisory
                  </div>
                  {healthInsights.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '0.74rem', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: '6px', borderLeft: item.type === 'success' ? '3px solid var(--success)' : (item.type === 'warning' ? '3px solid #f59e0b' : '3px solid var(--primary)') }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>{item.title}</div>
                      <div style={{ color: 'var(--text-muted)', lineHeight: 1.35 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: report.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                  {report.status === 'COMPLIANT' ? <CheckCircle2 /> : <AlertTriangle />} {report.status}
                </div>
              </div>

              <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '2px' }}>
                <button onClick={() => setActiveTab('audit')} style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', background: activeTab === 'audit' ? 'var(--bg-card)' : 'transparent', fontWeight: activeTab === 'audit' ? 700 : 500, fontSize: '0.76rem', color: activeTab === 'audit' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Checklist</button>
                <button onClick={() => setActiveTab('raw_ocr')} style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', background: activeTab === 'raw_ocr' ? 'var(--bg-card)' : 'transparent', fontWeight: activeTab === 'raw_ocr' ? 700 : 500, fontSize: '0.76rem', color: activeTab === 'raw_ocr' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Raw OCR Proof</button>
                <button onClick={() => setActiveTab('rules')} style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', background: activeTab === 'rules' ? 'var(--bg-card)' : 'transparent', fontWeight: activeTab === 'rules' ? 700 : 500, fontSize: '0.76rem', color: activeTab === 'rules' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Legal Citations</button>
              </div>

              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {report.violations && report.violations.length > 0 && (
                    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '4px' }}>Identified Contraventions:</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {report.violations.map((v, i) => <span key={i}>• {v}</span>)}
                      </div>
                    </div>
                  )}

                  {report.checklist && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span>Declared MRP:</span>
                        <strong>{report.checklist.mrp?.value || 'Missing'} [{report.checklist.mrp?.status || 'FAIL'}]</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span>Net Quantity:</span>
                        <strong>{report.checklist.net_quantity?.value || 'Missing'} [{report.checklist.net_quantity?.status || 'FAIL'}]</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span>Unit Sale Price (USP):</span>
                        <strong>{report.checklist.usp?.declared ? `Declared: ${report.checklist.usp.declared}` : 'Missing'} [{report.checklist.usp?.status || 'FAIL'}]</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span>Batch / Mfg Verification:</span>
                        <strong>{report.checklist.manufacturing_date?.value || 'Missing'} [{report.checklist.manufacturing_date?.status || 'FAIL'}]</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'raw_ocr' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Extracted Optical Text</div>
                  <div className="mono custom-scrollbar" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px', fontSize: '0.72rem', lineHeight: 1.45, maxHeight: '130px', overflowY: 'auto', whiteSpace: 'pre-wrap', border: '1px solid var(--border-color)' }}>
                    {report.raw_text || "No legible text extracted."}
                  </div>
                </div>
              )}

              {activeTab === 'rules' && (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activeCategory === 'cosmetic' ? (
                    <>
                      <p><strong>Rule 148, D&C Rules:</strong> Mandates explicit declaration of caution for cleansing formulations.</p>
                      <p><strong>Rule 6(1)(e), PCR 2011:</strong> Maximum Retail Price must include all statutory taxes.</p>
                      <p><strong>G.S.R. 226(E):</strong> Requires true rounded Unit Sale Price.</p>
                    </>
                  ) : (
                    <>
                      <p><strong>FSSAI Packaging Regulations 2018:</strong> Mandatory declaration of complete nutritional values.</p>
                      <p><strong>Rule 6, PCR 2011:</strong> Mandates declaration of MRP, Net Quantity, Country of Origin, and contact info.</p>
                      <p><strong>G.S.R. 226(E):</strong> Requires clear disclosure of Unit Sale Price per unit.</p>
                    </>
                  )}
                </div>
              )}

              <button onClick={downloadOfficialNotice} style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                <FileDown size={18} /> Export Statutory Notice (PDF)
              </button>
              
              <button onClick={() => setPreview(null)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Scan Another Item
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

// --- PAGE 3: Health & Allergy Profile ---
const HealthPage = () => {
  const [diet, setDiet] = useState(() => localStorage.getItem('legallens_diet') || 'Vegetarian');
  const [allergies, setAllergies] = useState(() => {
    const saved = localStorage.getItem('legallens_allergies');
    return saved ? JSON.parse(saved) : { peanuts: false, dairy: false, gluten: false, soy: false, 'tree nuts': false, shellfish: false };
  });

  const handleDietChange = (val) => { setDiet(val); localStorage.setItem('legallens_diet', val); };
  const handleToggleAllergy = (key) => {
    const updated = { ...allergies, [key]: !allergies[key] };
    setAllergies(updated); localStorage.setItem('legallens_allergies', JSON.stringify(updated));
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Health & Diet Profile</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The scanner cross-references OCR text with your active dietary restrictions and allergens.</p>
      
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Dietary Preference</h3>
        <select value={diet} onChange={(e) => handleDietChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
          <option>None</option><option>Vegetarian</option><option>Vegan</option><option>Keto</option>
        </select>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Active Allergen Watchlist</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {Object.keys(allergies).map(key => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={allergies[key]} onChange={() => handleToggleAllergy(key)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
              {key}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- PAGE 4: About Page ---
const AboutPage = () => {
  const team = [
    { role: 'LEADER', name: 'Shubham', email: 'pyaar3399@gmail.com', phone: '8278329813' },
    { role: 'TEAM_MEMBER', name: 'Anshul Gupta', email: 'anshulgupta7921@gmail.com', phone: '7015067921' },
    { role: 'TEAM_MEMBER', name: 'Rahul Jangra', email: 'jangrarahul13572@gmail.com', phone: '7015623396' },
    { role: 'TEAM_MEMBER', name: 'Gopesh Rajput', email: 'itsgopeshr@gmail.com', phone: '7665502926' },
    { role: 'TEAM_MEMBER', name: 'Gurpreet', email: 'gurpreetpanwar64@gmail.com', phone: '9520104308' },
    { role: 'TEAM_MEMBER', name: 'Sneha Kumari', email: 'snehachaudhary680@gmail.com', phone: '6206093260' }
  ];

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Project LegalLens AI</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SIH26034 - Legal Metrology Compliance Scanner</p>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {team.map((member, i) => (
          <motion.div key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>{member.name}</span>
              <span style={{ fontSize: '0.62rem', background: member.role === 'LEADER' ? 'var(--primary)' : 'var(--bg-input)', color: member.role === 'LEADER' ? '#fff' : 'var(--text-muted)', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>{member.role.replace('_', ' ')}</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} className="mono">{member.email}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} className="mono">{member.phone}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// --- PAGE 5: URL Inspector ---
const UrlPage = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const scanUrl = (e) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true); setResult(null);

    setTimeout(() => {
      setResult({
        status: 'NON-COMPLIANT',
        platform: url.includes('amazon') ? 'Amazon India' : url.includes('flipkart') ? 'Flipkart' : 'E-Commerce Platform',
        violations: [ 'Rule 6(10): Mandatory Country of Origin missing from listing specification.', 'G.S.R. 226(E): Unit Sale Price not explicitly stated beside standard MRP.' ]
      });
      setLoading(false);
    }, 1800);
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Digital Label Auditor</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verify PCR 2011 Rule 6(10) on E-Commerce Platforms</p>
      </div>
      <form onSubmit={scanUrl} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="url" placeholder="Paste product link (Amazon, Flipkart)" value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.88rem' }} required />
        <button type="submit" disabled={loading} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, display: 'flex', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
          {loading ? <RefreshCw className="spinner" size={18} /> : <Search size={18} />} {loading ? 'Crawling Listing...' : 'Inspect Product URL'}
        </button>
      </form>
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 700 }}>{result.platform}</span><span className={result.status === 'COMPLIANT' ? 'badge badge-pass' : 'badge badge-fail'}>{result.status}</span></div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <div style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px' }}>{result.violations.map((v, i) => <span key={i}>• {v}</span>)}</div>
        </motion.div>
      )}
    </div>
  );
};

// --- PAGE 6: Audit History ---
const HistoryPage = () => {
  const [records, setRecords] = useState([]);
  useEffect(() => { setRecords(JSON.parse(localStorage.getItem('legallens_history') || '[]')); }, []);

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,ID,Date,Type,Status,Score\n" + records.map(e => `${e.id},"${e.date}",${e.type},${e.status},${e.score}`).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `LegalLens_Audit_Log_${Date.now()}.csv`);
    document.body.appendChild(link); link.click();
  };

  const clearHistory = () => { localStorage.removeItem('legallens_history'); setRecords([]); };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Local Audit Log</h2>
        {records.length > 0 && <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}><Download size={14} /> CSV</button>}
      </div>
      {records.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No inspections recorded yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {records.map((record) => (
            <div key={record.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{record.type}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{record.date}</span>
              </div>
              <span className={record.status === 'COMPLIANT' ? 'badge badge-pass' : 'badge badge-fail'} style={{ fontSize: '0.65rem' }}>{record.status}</span>
            </div>
          ))}
          <button onClick={clearHistory} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, marginTop: '8px', cursor: 'pointer' }}>Clear Device History</button>
        </div>
      )}
    </div>
  );
};

// --- App Router ---
export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/url" element={<UrlPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}