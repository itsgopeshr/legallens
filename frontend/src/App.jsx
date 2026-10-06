import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, Moon, Sun, ShieldCheck, HeartPulse, 
  Info, Home, RefreshCw, CheckCircle2, AlertTriangle,
  Globe, History, Download, Search, FileDown, Check, ExternalLink
} from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';

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
        canvas.toBlob((blob) => resolve(blob ? new File([blob], "capture.jpg", { type: "image/jpeg" }) : file), 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
    };
  });
};

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '1.15rem', fontWeight: 800 }}>LegalLens AI</span><span style={{ fontSize: '0.62rem', background: 'var(--bg-input)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>OSINT</span></div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>OCR & Live Web Crawler</p>
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
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>AI Compliance Scanner</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Fills in missing package data using live internet searches.</p>
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
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('web'); // Default to the new Web tab
  
  // REPLACE WITH YOUR RENDER URL
  const BACKEND_URL = "https://legallens-370y.onrender.com/api/scan-label"; 

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
    setLoading(true); setReport(null); setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); 

      const res = await fetch(BACKEND_URL, { method: 'POST', body: formData, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      setReport(data);
      if (data.status === 'COMPLIANT') confetti();
    } catch (err) {
      setErrorMsg("Failed to connect. The server might be waking up or internet is slow.");
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Missing data will be fetched from the internet.</p>
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
                <div className="scanner-grid" /><div className="scanner-laser" />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '8px', zIndex: 11 }}><RefreshCw className="spinner" size={30} /><span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Crawling Live Internet...</span></div>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="card" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={20}/> Server Error</h4>
              <p style={{ fontSize: '0.8rem' }}>{errorMsg}</p>
              <button onClick={() => {setPreview(null); setErrorMsg(null);}} style={{ marginTop: '12px', padding: '8px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}>Try Again</button>
            </div>
          )}

          {!loading && report && !errorMsg && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* New Tab Navigator */}
              <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '3px' }}>
                <button onClick={() => setActiveTab('web')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'web' ? 'var(--primary)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'web' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>🌍 Live Web Data</button>
                <button onClick={() => setActiveTab('audit')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'audit' ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'audit' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Checklist</button>
                <button onClick={() => setActiveTab('raw_ocr')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: activeTab === 'raw_ocr' ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: '0.76rem', color: activeTab === 'raw_ocr' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Raw OCR</button>
              </div>

              {/* TAB 1: Live Web Intelligence (NEW) */}
              {activeTab === 'web' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={16} color="var(--primary)" /> Real-Time Search Results
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Data fetched directly from the internet based on packaging text.</p>
                  
                  {report.web_intelligence && report.web_intelligence.length > 0 ? (
                    report.web_intelligence.map((item, idx) => (
                      <div key={idx} style={{ padding: '10px', background: 'var(--bg-input)', borderLeft: '3px solid var(--primary)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ fontSize: '0.8rem' }}>{item.title}</strong>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.body.substring(0, 140)}...</p>
                        {item.link && item.link !== '#' && (
                          <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600, marginTop: '4px' }}>
                            View Source <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)', padding: '10px', background: 'var(--bg-input)', borderRadius: '6px' }}>Could not extract reliable search keywords from this image.</div>
                  )}
                </div>
              )}

              {/* TAB 2: Metrology Checklist */}
              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {report.checklist && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Detected MRP:</span><strong>{report.checklist.mrp?.value || 'Missing'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Net Quantity:</span><strong>{report.checklist.net_quantity?.value || 'Missing'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Mfg / Batch:</span><strong>{report.checklist.manufacturing_date?.value || 'Missing'}</strong></div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Raw OCR */}
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

const HealthPage = () => <div style={{ padding: '20px' }}><h2>Health & Allergy Profile</h2><p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px'}}>Nutrition and allergen alerts will automatically appear in the Web Data tab during scans based on live internet ingredients.</p></div>;
const HistoryPage = () => <div style={{ padding: '20px' }}><h2>Audit Logs</h2></div>;
const AboutPage = () => <div style={{ padding: '20px' }}><h2>Team LegalLens</h2></div>;

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
  
