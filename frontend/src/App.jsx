import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, Moon, Sun, ShieldCheck, HeartPulse, 
  Info, Home, RefreshCw, CheckCircle2, AlertTriangle,
  Globe, History, Download, Search, FileDown, ExternalLink, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import Tesseract from 'tesseract.js';

// --- Client-Side Image Resizer ---
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; // Optimized for Tesseract.js speed
        const scaleSize = MAX_WIDTH / img.width;
        if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        const ctx = canvas.getContext('2d');
        ctx.filter = 'contrast(1.2) grayscale(1)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob ? new File([blob], "capture.jpg", { type: "image/jpeg" }) : file), 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
    };
  });
};

// --- Real-Time OSINT Web Crawler (Wikipedia REST API) ---
const fetchLiveWebData = async (text) => {
  const stopwords = ['INGREDIENTS', 'AQUA', 'WATER', 'MRP', 'NET', 'QTY', 'VOL', 'USE', 'BEFORE', 'BATCH', 'MFG', 'RS', 'PRICE', 'CONSUMER', 'CARE', 'LTD', 'PVT', 'INDIA', 'LIMITED'];
  const words = text.toUpperCase().match(/\b[A-Z]{5,}\b/g) || [];
  
  const keywords = [...new Set(words.filter(w => !stopwords.includes(w)))].slice(0, 2);
  if (keywords.length === 0) return [];

  const results = [];
  for (const keyword of keywords) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${keyword.toLowerCase()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.extract) {
          results.push({
            title: data.title,
            body: data.extract,
            link: data.content_urls?.desktop?.page || '#'
          });
        }
      }
    } catch (e) { console.warn("Crawler skipped keyword due to network:", keyword); }
  }
  return results;
};

// --- On-Device Rules Engine ---
const analyzeLabelJS = async (rawText) => {
  let text = rawText.replace(/\n/g, " ").toUpperCase();
  text = text.replace(/[\?*€]/g, '₹');

  // 1. MRP
  let mrpVal = null;
  const mrpMatch1 = text.match(/(?:MRP|M\.R\.P\.?|MAX\.?\s*RETAIL\s*PRICE)\D{0,10}(?:RS\.?|₹)?\s*(\d{2,5}(?:\.\d{1,2})?)/);
  const mrpMatch2 = text.match(/(?:₹|RS\.?)\s*[:=.]?\s*(\d{2,5}(?:\.\d{1,2})?)/);
  if (mrpMatch1) mrpVal = parseFloat(mrpMatch1[1]);
  else if (mrpMatch2) mrpVal = parseFloat(mrpMatch2[1]);

  // 2. Net Quantity
  let netQtyVal = null, netQtyUnit = null;
  const qtyMatch1 = text.match(/(?:NET\s*(?:WT|QTY|VOL|VOLUME)?[:.]?\s*)(\d+(?:\.\d+)?)\s*(G|GM|GMS|ML|KG|L)\b/);
  const qtyMatch2 = text.match(/\b(\d{2,4})\s*(ML|G|GM)\b/);
  
  if (qtyMatch1) {
    netQtyVal = parseFloat(qtyMatch1[1]);
    netQtyUnit = qtyMatch1[2].toLowerCase();
  } else if (qtyMatch2) {
    const contextStart = Math.max(0, qtyMatch2.index - 15);
    const context = text.substring(contextStart, qtyMatch2.index);
    if (!context.includes('SERVE') && !context.includes('ENERGY')) {
      netQtyVal = parseFloat(qtyMatch2[1]);
      netQtyUnit = qtyMatch2[2].toLowerCase();
    }
  }
  if (netQtyUnit === 'gm' || netQtyUnit === 'gms') netQtyUnit = 'g';

  // 3. USP
  let calculatedUsp = null, expectedUspStr = null, declaredUspStr = null, declaredVal = null;
  if (mrpVal && netQtyVal && netQtyVal > 0) {
    const baseUnit = netQtyUnit?.includes('g') ? 'g' : 'ml';
    calculatedUsp = mrpVal / netQtyVal;
    expectedUspStr = `₹${calculatedUsp.toFixed(2)}/${baseUnit}`;
  }
  const uspMatch = text.match(/(?:USP|U\.S\.P\.?|@)?\s*[:=]?\s*(?:RS\.?|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:\/|PER)\s*(G|ML|KG|L)/);
  if (uspMatch) {
    declaredVal = parseFloat(uspMatch[1]);
    declaredUspStr = `₹${declaredVal.toFixed(2)}/${uspMatch[2].toLowerCase()}`;
  }

  // 4. Dates & Batch
  let mfgDate = null;
  const dateMatch = text.match(/\b(0[1-9]|1[0-2])[\/\-](\d{2,4})\b/);
  const batchMatch = text.match(/\b(BSTN\w+|LOT\w+|B\.\s*NO\w*)\b/);
  if (dateMatch) mfgDate = dateMatch[0];
  else if (batchMatch) mfgDate = batchMatch[0];

  // 5. Care & Category
  const careMatch = text.match(/(?:CONSUMER|CARE|FEEDBACK|HELPLINE|TOLL\s*FREE|1800|RECKITT|ZYDUS|@|\.COM)/);
  
  let category = "general";
  if (/(AQUA|SULFATE|PARFUM|EXTERNAL USE|SHAMPOO|SOAP|LOTION|HANDWASH)/.test(text)) category = "cosmetic";
  else if (/(SUGAR|CARBOHYDRATE|PROTEIN|FAT|KCAL|ENERGY|INGREDIENTS|FSSAI|SUCROSE|DEXTROSE)/.test(text)) category = "food";

  // 6. Violations
  const violations = [];
  if (!mrpVal) violations.push("Rule 6(1)(e): Maximum Retail Price (MRP) missing or illegible.");
  if (!netQtyVal) violations.push("Rule 6(1)(b): Standard Net Quantity declaration missing.");
  if (mrpVal && netQtyVal) {
    if (!declaredUspStr) violations.push(`G.S.R. 226(E): Unit Sale Price not explicitly stated (Computed: ${expectedUspStr}).`);
    else if (declaredVal && Math.abs(declaredVal - calculatedUsp) > 0.06) violations.push(`G.S.R. 226(E): USP mismatch (Declared: ${declaredUspStr}, True: ${expectedUspStr}).`);
  }
  if (!mfgDate) violations.push("Rule 6(1)(d): Month/Year of packing or Batch No. not detected.");
  if (!careMatch) violations.push("Rule 6(2): Consumer care contact channel not found.");
  if (category === 'cosmetic' && !text.includes('EXTERNAL USE')) violations.push("D&C Rules: Caution 'For External Use Only' declaration requires verification.");

  const webData = await fetchLiveWebData(text);

  return {
    status: violations.length === 0 ? "COMPLIANT" : "NON-COMPLIANT",
    category,
    violations,
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

// --- App Shell & Layout ---
const Layout = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  useEffect(() => document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'), [isDark]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={26} color="var(--primary)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '1.15rem', fontWeight: 800 }}>LegalLens AI</span><span style={{ fontSize: '0.62rem', background: 'var(--bg-input)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>EDGE</span></div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>On-Device Scanner</p>
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
        <NavIcon to="/health" icon={<HeartPulse size={20} />} label="Health" current={location.pathname} />
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

const HomePage = () => {
  const navigate = useNavigate();
  const handleSelection = async (e) => {
    if (!e.target.files[0]) return;
    navigate('/scan', { state: { directFile: await compressImage(e.target.files[0]) } });
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>Edge Compliance OCR</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Zero server latency. Real web intelligence.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <input type="file" accept="image/*" capture="environment" id="home-camera" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-camera" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}><div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '50%' }}><Camera size={30} color="var(--primary)" /></div><span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Live Camera</span></label>
        <input type="file" accept="image/*" id="home-upload" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-upload" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}><div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '50%' }}><Upload size={30} color="var(--primary)" /></div><span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Upload Image</span></label>
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
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('web');

  useEffect(() => {
    if (location.state?.directFile) {
      executeScan(location.state.directFile);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleManualSelection = async (e) => {
    if (!e.target.files[0]) return;
    executeScan(await compressImage(e.target.files[0]));
  };

  const executeScan = async (file) => {
    setPreview(URL.createObjectURL(file));
    setLoading(true); setReport(null); setProgress(0);
    setStatusMsg('Loading OCR Engine...');

    try {
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
            setStatusMsg(`Scanning: ${Math.round(m.progress * 100)}%`);
          } else {
            setStatusMsg("Initializing Engine...");
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setStatusMsg('Auditing & Crawling Internet...');
      const finalReport = await analyzeLabelJS(text);
      
      setReport(finalReport);
      if (finalReport.status === 'COMPLIANT') confetti();

    } catch (err) {
      console.error(err);
      setStatusMsg("Failed to process image locally.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!preview ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}>
          <Camera size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Scan Packaging</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Real-time local processing. Missing data fetched from the web.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleManualSelection} style={{ display: 'none' }} id="cam-input-scan" />
            <label htmlFor="cam-input-scan" style={{ background: 'var(--primary)', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={18}/> Camera</label>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ position: 'relative', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Scanned" />
            {loading && (
              <>
                <div className="scanner-grid" />
                <div className="scanner-laser" />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '12px', zIndex: 11, padding: '20px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{statusMsg}</span>
                  <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }} />
                  </div>
                </div>
              </>
            )}
          </div>

          {!loading && report && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '3px' }}>
                <button onClick={() => setActiveTab('web')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'web' ? 'var(--primary)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'web' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>🌍 Web Data</button>
                <button onClick={() => setActiveTab('audit')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'audit' ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'audit' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Checklist</button>
                <button onClick={() => setActiveTab('raw_ocr')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'raw_ocr' ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'raw_ocr' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Raw OCR</button>
              </div>

              {activeTab === 'web' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={16} color="var(--primary)" /> Real-Time Intelligence
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cross-referencing packaging keywords with open internet sources.</p>
                  
                  {report.web_intelligence && report.web_intelligence.length > 0 ? (
                    report.web_intelligence.map((item, idx) => (
                      <div key={idx} style={{ padding: '10px', background: 'var(--bg-input)', borderLeft: '3px solid var(--primary)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ fontSize: '0.8rem' }}>{item.title}</strong>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.body}</p>
                        {item.link && item.link !== '#' && (
                          <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600, marginTop: '4px' }}>
                            Read Wikipedia Article <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)', padding: '10px', background: 'var(--bg-input)', borderRadius: '6px' }}>Could not extract search keywords from this scan. Try taking a clearer photo of the ingredients.</div>
                  )}
                </div>
              )}

              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: report.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                    {report.status === 'COMPLIANT' ? <CheckCircle2 /> : <AlertTriangle />} {report.status}
                  </div>
                  {report.violations.length > 0 && (
                     <div style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--danger-bg)', padding: '10px', borderRadius: '8px' }}>
                       {report.violations.map((v, i) => <span key={i}>• {v}</span>)}
                     </div>
                  )}
                  {report.checklist && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Detected MRP:</span><strong>{report.checklist.mrp?.value || 'Missing'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Net Quantity:</span><strong>{report.checklist.net_quantity?.value || 'Missing'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Unit Sale Price:</span><strong>{report.checklist.usp?.declared || 'Missing'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Mfg / Batch:</span><strong>{report.checklist.manufacturing_date?.value || 'Missing'}</strong></div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'raw_ocr' && (
                <div className="mono custom-scrollbar" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px', fontSize: '0.72rem', lineHeight: 1.45, maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap', border: '1px solid var(--border-color)' }}>
                  {report.raw_text || "No legible text extracted."}
                </div>
              )}

              <button onClick={() => setPreview(null)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}>
                Scan Another Product
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

const HealthPage = () => <div style={{ padding: '20px' }}><h2>Health Profile</h2><p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px'}}>Cross-referencing logic is now handled locally on your device.</p></div>;
const HistoryPage = () => <div style={{ padding: '20px' }}><h2>Audit Logs</h2></div>;
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
      <div style={{ textAlign: 'center' }}><h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Project LegalLens AI</h2><p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SIH26034 - Legal Metrology Compliance Scanner</p></div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {team.map((member, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 800, fontSize: '1rem' }}>{member.name}</span><span style={{ fontSize: '0.62rem', background: member.role === 'LEADER' ? 'var(--primary)' : 'var(--bg-input)', color: member.role === 'LEADER' ? '#fff' : 'var(--text-muted)', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>{member.role.replace('_', ' ')}</span></div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{member.email}</span>
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
          <Route path="/health" element={<HealthPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
