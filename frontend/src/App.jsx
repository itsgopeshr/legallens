import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, Moon, Sun, ShieldCheck, HeartPulse, 
  Info, Home, CheckCircle2, AlertTriangle,
  Globe, History, FileDown, ExternalLink, Zap
} from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import Tesseract from 'tesseract.js';

// --- Background AI Pre-loader (Prevents freezing on bad Wi-Fi) ---
let aiWorker = null;
const initAI = async () => {
  if (!aiWorker) {
    try {
      aiWorker = await Tesseract.createWorker('eng', 1);
      console.log("Edge AI pre-loaded successfully.");
    } catch (e) { console.warn("Background AI load failed, will retry on scan."); }
  }
};

// --- Client-Side Image Preprocessing ---
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
        canvas.width = scaleSize < 1 ? MAX_WIDTH : img.width;
        canvas.height = scaleSize < 1 ? img.height * scaleSize : img.height;
        const ctx = canvas.getContext('2d');
        ctx.filter = 'contrast(1.4) brightness(1.1) grayscale(100%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob ? new File([blob], "capture.jpg", { type: "image/jpeg" }) : file), 'image/jpeg', 0.9);
      };
      img.onerror = () => resolve(file);
    };
  });
};

// --- OSINT Crawler with Local Caching (Prevents API Blocks) ---
const fetchLiveWebData = async (text) => {
  const stopwords = ['NUTRITION', 'INFORMATION', 'INGREDIENTS', 'AQUA', 'WATER', 'MRP', 'NET', 'QTY', 'VOL', 'USE', 'BEFORE', 'BATCH', 'MFG', 'PRICE', 'CONSUMER', 'CARE', 'LTD', 'PVT', 'INDIA', 'LIMITED', 'SERVE', 'TOTAL', 'MANUFACTURED', 'MARKETED', 'DETAILS', 'COMPOSITION', 'APPROX', 'VALUE', 'DIETARY', 'RECOMMENDED', 'ENERGY', 'PROTEIN', 'CARBOHYDRATE', 'SUGARS', 'FAT', 'SATURATED', 'CHOLESTEROL', 'STORE', 'COOL', 'DRY', 'PLACE', 'AWAY', 'SUNLIGHT', 'KCAL', 'GMS', 'WEIGHT', 'VOLUME', 'TAXES'];
  const rawWords = text.toUpperCase().replace(/[^A-Z]/g, ' ').split(/\s+/).filter(w => w.length > 5);
  const keywords = [...new Set(rawWords.filter(w => !stopwords.includes(w)))].slice(0, 3);
  
  if (keywords.length === 0) return [];
  const results = [];
  
  for (const keyword of keywords) {
    // Check Cache First
    const cached = localStorage.getItem(`osint_${keyword}`);
    if (cached) {
      results.push(JSON.parse(cached));
      continue;
    }

    try {
      const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${keyword}&utf8=&format=json&origin=*`);
      const searchData = await searchRes.json();

      if (searchData.query?.search?.length > 0) {
        const autocorrectedTitle = searchData.query.search[0].title;
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(autocorrectedTitle)}`);
        
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (summaryData.extract && !results.some(r => r.title === summaryData.title)) {
            const finalData = {
              title: summaryData.title,
              body: summaryData.extract.substring(0, 220) + '...',
              link: summaryData.content_urls?.desktop?.page || '#'
            };
            // Save to Cache
            localStorage.setItem(`osint_${keyword}`, JSON.stringify(finalData));
            results.push(finalData);
          }
        }
      }
    } catch (e) { console.warn("OSINT Crawler skipped:", keyword); }
  }
  return results;
};

// --- On-Device Rules Engine ---
const analyzeLabelJS = async (rawText) => {
  let text = rawText.replace(/\n/g, " ").toUpperCase();
  text = text.replace(/[\?*€]/g, '₹').replace(/\bE(\d{2,4})\b/g, '₹$1');

  let mrpVal = null, netQtyVal = null, netQtyUnit = null, declaredVal = null, declaredUspStr = null, mfgDate = null;

  const mrpMatch = text.match(/(?:MRP|M\.R\.P\.?|RETAIL\s*PRICE)?\D{0,10}(?:RS\.?|₹|R\$)\s*[A-Z]?[:=.]?\s*(\d{2,5}(?:\.\d{1,2})?)/) || text.match(/\b(\d{2,5})\s*\/-/);
  if (mrpMatch) mrpVal = parseFloat(mrpMatch[1]);

  const qtyMatch = text.match(/(?:NET\s*(?:WT|QTY|VOL|VOLUME)?[:.]?\s*)(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\b/) || text.match(/[\^#]?\s*(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\s*(?:NET|VOL|QTY)?\b/) || text.match(/\b(\d{2,4})\s*(ML|G|GM)\b/);
  if (qtyMatch) {
    const context = text.substring(Math.max(0, qtyMatch.index - 20), qtyMatch.index);
    if (!context.includes('SERVE') && !context.includes('ENERGY') && !context.includes('PER PACK')) {
      netQtyVal = parseFloat(qtyMatch[1]);
      netQtyUnit = qtyMatch[2].toLowerCase().replace('gms', 'g').replace('gm', 'g');
    }
  }

  let calculatedUsp = null, expectedUspStr = null;
  if (mrpVal && netQtyVal && netQtyVal > 0) {
    const baseUnit = netQtyUnit === 'g' ? 'g' : 'ml';
    calculatedUsp = mrpVal / netQtyVal;
    expectedUspStr = `₹${calculatedUsp.toFixed(2)}/${baseUnit}`;
  }
  const uspMatch = text.match(/(?:USP|U\.S\.P\.?|@)?\s*[:=]?\s*(?:RS\.?|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:\/|PER)\s*(G|ML|KG|L)/);
  if (uspMatch) {
    declaredVal = parseFloat(uspMatch[1]);
    declaredUspStr = `₹${declaredVal.toFixed(2)}/${uspMatch[2].toLowerCase()}`;
  }

  const dateMatch = text.match(/\b(0[1-9]|1[0-2])[\/\-](\d{2,4})\b/) || text.match(/\b(BSTN\w+|LOT\w+|B\.\s*NO\w*)\b/);
  if (dateMatch) mfgDate = dateMatch[0];

  const careMatch = text.match(/(?:CONSUMER|CARE|FEEDBACK|HELPLINE|TOLL\s*FREE|1800|RECKITT|ZYDUS|@|\.COM)/);
  
  let category = "general";
  if (/(AQUA|SULFATE|PARFUM|EXTERNAL USE|SHAMPOO|SOAP|LOTION|HANDWASH)/.test(text)) category = "cosmetic";
  else if (/(SUGAR|CARBOHYDRATE|PROTEIN|FAT|KCAL|ENERGY|INGREDIENTS|FSSAI|SUCROSE|DEXTROSE)/.test(text)) category = "food";

  const violations = [];
  if (!mrpVal) violations.push("Rule 6(1)(e): Maximum Retail Price (MRP) missing.");
  if (!netQtyVal) violations.push("Rule 6(1)(b): Standard Net Quantity declaration missing.");
  if (mrpVal && netQtyVal) {
    if (!declaredUspStr) violations.push(`G.S.R. 226(E): Unit Sale Price not explicitly stated.`);
    else if (declaredVal && Math.abs(declaredVal - calculatedUsp) > 0.06) violations.push(`G.S.R. 226(E): USP mathematical mismatch.`);
  }
  if (!mfgDate) violations.push("Rule 6(1)(d): Month/Year of packing or Batch No. not detected.");
  if (!careMatch) violations.push("Rule 6(2): Consumer care contact channel not found.");

  const webData = await fetchLiveWebData(text);
  const status = violations.length === 0 ? "COMPLIANT" : "NON-COMPLIANT";

  return {
    status, category, violations,
    checklist: {
      mrp: { value: mrpVal ? `₹${mrpVal.toFixed(2)}` : "Missing", status: mrpVal ? "PASS" : "FAIL" },
      net_quantity: { value: netQtyVal ? `${netQtyVal} ${netQtyUnit}` : "Missing", status: netQtyVal ? "PASS" : "FAIL" },
      usp: { declared: declaredUspStr || "Missing", calculated: expectedUspStr || "N/A", status: (declaredUspStr && (!calculatedUsp || Math.abs((declaredVal || 0) - calculatedUsp) <= 0.06)) ? "PASS" : "FAIL" },
      manufacturing_date: { value: mfgDate || "Missing", status: mfgDate ? "PASS" : "FAIL" }
    },
    raw_text: rawText,
    web_intelligence: webData
  };
};

// --- Shell & Navigation ---
const Layout = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  useEffect(() => { document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); initAI(); }, [isDark]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={26} color="var(--primary)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '1.15rem', fontWeight: 800 }}>LegalLens AI</span><span style={{ fontSize: '0.62rem', background: 'var(--primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}><Zap size={10}/> EDGE</span></div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>On-Device OSINT Scanner</p>
          </div>
        </div>
        <button onClick={() => setIsDark(!isDark)} style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-main)', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
      </header>
      <main style={{ flex: 1, position: 'relative' }}>
        <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ height: '100%' }}>{children}</motion.div></AnimatePresence>
      </main>
      <nav style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 4px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', position: 'sticky', bottom: 0, zIndex: 50, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <NavIcon to="/" icon={<Home size={20} />} label="Home" current={location.pathname} />
        <NavIcon to="/scan" icon={<Camera size={20} />} label="Scan" current={location.pathname} />
        <NavIcon to="/history" icon={<History size={20} />} label="Logs" current={location.pathname} />
        <NavIcon to="/about" icon={<Info size={20} />} label="Team" current={location.pathname} />
      </nav>
    </div>
  );
};

const NavIcon = ({ to, icon, label, current }) => {
  const active = current === to;
  return <Link to={to} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: active ? 'var(--primary)' : 'var(--text-muted)', flex: 1 }}>{icon}<span style={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500 }}>{label}</span></Link>;
};

// --- Pages ---
const HomePage = () => {
  const navigate = useNavigate();
  const handleSelection = async (e) => {
    if (!e.target.files[0]) return;
    navigate('/scan', { state: { directFile: await compressImage(e.target.files[0]) } });
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px', background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-input) 100%)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>Live Product Auditing</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Scan packaging. Missing data is fetched live from Wikipedia OSINT.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <input type="file" accept="image/jpeg, image/png" capture="environment" id="home-camera" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-camera" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}><div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '14px', borderRadius: '50%' }}><Camera size={30} color="var(--primary)" /></div><span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Live Camera</span></label>
        <input type="file" accept="image/jpeg, image/png" id="home-upload" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-upload" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}><div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '14px', borderRadius: '50%' }}><Upload size={30} color="var(--primary)" /></div><span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Upload Image</span></label>
      </div>
    </div>
  );
};

const ScanPage = () => {
  const location = useLocation();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('web');

  useEffect(() => {
    if (location.state?.directFile) {
      executeScan(location.state.directFile);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const saveAuditLog = (finalReport) => {
    const existing = JSON.parse(localStorage.getItem('legallens_logs') || '[]');
    localStorage.setItem('legallens_logs', JSON.stringify([{ id: Date.now(), date: new Date().toLocaleString(), status: finalReport.status, category: finalReport.category }, ...existing]));
  };

  const handleManualSelection = async (e) => {
    if (!e.target.files[0]) return;
    executeScan(await compressImage(e.target.files[0]));
  };

  const executeScan = async (file) => {
    setPreview(URL.createObjectURL(file));
    setLoading(true); setReport(null); setProgress(0); setConfidence(0);
    setStatusMsg('Warming up Edge AI...');

    try {
      if (!aiWorker) await initAI();
      const worker = aiWorker || await Tesseract.createWorker('eng', 1);
      
      const { data } = await worker.recognize(file, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
            setStatusMsg(`Extracting Text: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      setConfidence(Math.round(data.confidence));
      setStatusMsg('OSINT Web Crawling...');
      const finalReport = await analyzeLabelJS(data.text);
      
      setReport(finalReport);
      saveAuditLog(finalReport);
      if (finalReport.status === 'COMPLIANT') confetti();

    } catch (err) {
      setStatusMsg("Lens dirty or glare detected. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 24, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text("MINISTRY OF CONSUMER AFFAIRS - LEGAL METROLOGY DIVISION", 105, 14, { align: "center" });
    doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.text("STATUTORY PRE-ENFORCEMENT AUDIT NOTICE", 105, 36, { align: "center" });
    doc.setLineWidth(0.4); doc.setDrawColor(203, 213, 225); doc.line(15, 40, 195, 40);

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Reference No: LM/PCR-${Date.now().toString().slice(-6)}`, 15, 48);
    doc.text(`Inspection Time: ${new Date().toLocaleString()}`, 15, 54);

    const isPass = report.status === 'COMPLIANT';
    doc.setFillColor(isPass ? 220 : 254, isPass ? 252 : 226, isPass ? 231 : 226);
    doc.roundedRect(15, 62, 180, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(isPass ? 22 : 220, isPass ? 163 : 38, isPass ? 74 : 38);
    doc.text(`VERDICT: ${isPass ? 'COMPLIANT WITH PCR 2011' : 'CONTRAVENTION DETECTED'}`, 20, 70);

    doc.setTextColor(15, 23, 42); doc.setFontSize(9.5); doc.text("SCHEDULE OF DECLARATIONS:", 15, 85);
    let y = 92;
    [["Maximum Retail Price (MRP)", report.checklist.mrp], ["Net Quantity", report.checklist.net_quantity], ["Unit Sale Price (USP)", report.checklist.usp], ["Manufacturing / Batch", report.checklist.manufacturing_date]].forEach(([k, v]) => {
      doc.setFont("helvetica", "normal"); doc.text(`• ${k}`, 20, y);
      doc.setFont("helvetica", "bold"); doc.text(`${v.value || v.declared} [${v.status}]`, 140, y); y += 8;
    });

    if (report.violations.length > 0) {
      y += 5; doc.setTextColor(220, 38, 38); doc.text("VIOLATIONS:", 15, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
      report.violations.forEach(v => { const lines = doc.splitTextToSize(`- ${v}`, 170); doc.text(lines, 20, y); y += lines.length * 5; });
    }
    doc.save(`Audit_Report_${Date.now()}.pdf`);
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!preview ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}>
          <Camera size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Scan Packaging</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Ensure good lighting. Avoid glare on plastic wrappers.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="file" accept="image/jpeg, image/png" capture="environment" onChange={handleManualSelection} style={{ display: 'none' }} id="cam-input-scan" />
            <label htmlFor="cam-input-scan" style={{ background: 'var(--primary)', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={18}/> Camera</label>
            <input type="file" accept="image/jpeg, image/png" onChange={handleManualSelection} style={{ display: 'none' }} id="upload-input-scan" />
            <label htmlFor="upload-input-scan" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={18}/> Upload</label>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ position: 'relative', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Scanned" />
            {loading && (
              <>
                <div className="scanner-grid" /><div className="scanner-laser" />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '12px', zIndex: 11, padding: '20px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{statusMsg}</span>
                  <div style={{ width: '80%', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress * 100}%`, height: '100%', background: '#60a5fa', transition: 'width 0.2s' }} />
                  </div>
                </div>
              </>
            )}
          </div>

          {!loading && report && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* AI Confidence Metric */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <span>AI Optical Confidence</span>
                <span style={{ color: confidence > 70 ? 'var(--success)' : 'var(--warning)' }}>{confidence}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden', marginTop: '-8px' }}>
                 <div style={{ width: `${confidence}%`, height: '100%', background: confidence > 70 ? 'var(--success)' : 'var(--warning)' }} />
              </div>

              <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '3px', marginTop: '4px' }}>
                <button onClick={() => setActiveTab('web')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'web' ? 'var(--primary)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'web' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>🌍 OSINT Data</button>
                <button onClick={() => setActiveTab('audit')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'audit' ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'audit' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Checklist</button>
                <button onClick={() => setActiveTab('raw')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'raw' ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'raw' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Raw OCR</button>
              </div>

              {activeTab === 'web' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={16} color="var(--primary)" /> Real-Time Intelligence</div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Using Wikipedia's NLP Search to autocorrect OCR typos and pull accurate chemical/brand data.</p>
                  
                  {report.web_intelligence.length > 0 ? report.web_intelligence.map((item, idx) => (
                    <div key={idx} style={{ padding: '10px', background: 'var(--bg-input)', borderLeft: '3px solid var(--primary)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '0.8rem' }}>{item.title}</strong>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.body}</p>
                      <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600, marginTop: '4px' }}>Verify Source <ExternalLink size={12} /></a>
                    </div>
                  )) : <div style={{ fontSize: '0.75rem', color: 'var(--warning)', padding: '10px', background: 'var(--bg-input)', borderRadius: '6px' }}>Could not extract reliable search keywords. Tip: Flatten the plastic wrapper to reduce light glare.</div>}
                </div>
              )}

              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: report.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)', fontWeight: 800, padding: '8px', background: report.status === 'COMPLIANT' ? 'var(--success-bg)' : 'transparent', borderRadius: '8px' }}>
                    {report.status === 'COMPLIANT' ? <CheckCircle2 /> : <AlertTriangle />} {report.status}
                  </div>
                  {report.violations.length > 0 && (
                     <div style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--danger-bg)', padding: '10px', borderRadius: '8px' }}>
                       <strong style={{marginBottom: '4px'}}>Contraventions / Notes:</strong>
                       {report.violations.map((v, i) => <span key={i}>• {v}</span>)}
                     </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Detected MRP:</span><strong>{report.checklist.mrp.value}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Net Quantity:</span><strong>{report.checklist.net_quantity.value}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Unit Sale Price:</span><strong>{report.checklist.usp.declared}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Mfg / Batch:</span><strong>{report.checklist.manufacturing_date.value}</strong></div>
                  </div>
                  <button onClick={generatePDF} style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}><FileDown size={18} /> Export Statutory Notice</button>
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="mono custom-scrollbar" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px', fontSize: '0.72rem', lineHeight: 1.45, maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap', border: '1px solid var(--border-color)' }}>{report.raw_text}</div>
              )}

              <button onClick={() => setPreview(null)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}>Scan Another Product</button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

const HistoryPage = () => {
  const [logs, setLogs] = useState([]);
  useEffect(() => setLogs(JSON.parse(localStorage.getItem('legallens_logs') || '[]')), []);
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Audit Logs</h2><button onClick={() => {localStorage.removeItem('legallens_logs'); setLogs([]);}} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Clear All</button></div>
      {logs.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No local audits recorded yet.</p> : logs.map(log => (
        <div key={log.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>{log.category} Product</span><span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{log.date}</span></div>
          <span style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '12px', fontWeight: 700, background: log.status === 'COMPLIANT' ? 'var(--success-bg)' : 'var(--danger-bg)', color: log.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)' }}>{log.status}</span>
        </div>
      ))}
    </div>
  );
};

const AboutPage = () => {
  const team = [
    { role: 'LEADER', name: 'Shubham', email: 'pyaar3399@gmail.com' },
    { role: 'TEAM_MEMBER', name: 'Anshul Gupta', email: 'anshulgupta7921@gmail.com' },
    { role: 'TEAM_MEMBER', name: 'Rahul Jangra', email: 'jangrarahul13572@gmail.com' },
    { role: 'TEAM_MEMBER', name: 'Gopesh Rajput', email: 'itsgopeshr@gmail.com' },
    { role: 'TEAM_MEMBER', name: 'Gurpreet', email: 'gurpreetpanwar64@gmail.com' },
    { role: 'TEAM_MEMBER', name: 'Sneha Kumari', email: 'snehachaudhary680@gmail.com' }
  ];
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}><h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Team LegalLens</h2><p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SIH26034 - Legal Metrology Scanner</p></div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {team.map((member, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{member.name}</span><span style={{ fontSize: '0.62rem', background: member.role === 'LEADER' ? 'var(--primary)' : 'var(--bg-input)', color: member.role === 'LEADER' ? '#fff' : 'var(--text-muted)', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>{member.role.replace('_', ' ')}</span></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
