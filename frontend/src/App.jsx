import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, Moon, Sun, ShieldCheck, 
  Info, Home, CheckCircle2, AlertTriangle,
  History, FileDown, Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';

const GEMINI_API_KEY = "AQ.Ab8RN6LJK0hVOAK3HofPG6ZPTmLCrBD7IOzGCHIPDcU278zWkg";

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        resolve(base64Data);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const runGeminiVisionAudit = async (base64Image) => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
You are a senior enforcement officer under the Legal Metrology (Packaged Commodities) Rules, 2011 (PCR 2011) in India.
Analyze this packaging image and extract statutory declarations precisely:
1. Product/Brand Name (e.g., Glucon-D, Dettol).
2. Category: Exactly "food", "cosmetic", or "general".
3. Maximum Retail Price (MRP): Numerical value in Rupees (e.g., ₹435.00 or ₹99.00). Look for printed ink stamps, bottom flaps, or labels.
4. Net Quantity: Net weight or volume (e.g., "1 kg", "200 ml"). Do NOT confuse with serving sizes like "per serve 35g".
5. Declared Unit Sale Price (USP): As per G.S.R. 226(E) (e.g., ₹0.44/g or ₹0.50/ml).
6. Manufacturing / Packaging Date / Batch No.
7. Product Intelligence: A concise 2-sentence factual overview of the product, ingredients, and key legal declarations.

Return ONLY a valid JSON object matching this schema without markdown fences:
{
  "productName": "string",
  "category": "food" | "cosmetic" | "general",
  "mrp": "string with currency, e.g., ₹435.00, or null",
  "mrpValue": number or null,
  "netQuantity": "string, e.g., 1 kg, 200 ml, or null",
  "netQuantityValue": number or null,
  "netQuantityUnit": "string, e.g., g, ml, or null",
  "declaredUsp": "string or null",
  "mfgDate": "string or null",
  "violations": ["string list of missing or invalid declarations under PCR 2011"],
  "productIntelligence": "string summary"
}
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `API Error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error("No output received from the Vision AI.");

  const parsed = JSON.parse(textOutput);

  let computedUsp = null;
  if (parsed.mrpValue && parsed.netQuantityValue && parsed.netQuantityValue > 0) {
    let unit = (parsed.netQuantityUnit || 'g').toLowerCase();
    let qty = parsed.netQuantityValue;
    if (unit === 'kg') { qty *= 1000; unit = 'g'; }
    if (unit === 'l') { qty *= 1000; unit = 'ml'; }
    computedUsp = `₹${(parsed.mrpValue / qty).toFixed(2)}/${unit}`;
  }

  return {
    status: (parsed.violations && parsed.violations.length === 0) ? "COMPLIANT" : "NON-COMPLIANT",
    productName: parsed.productName || "Consumer Package",
    category: parsed.category || "general",
    violations: parsed.violations || [],
    checklist: {
      mrp: { value: parsed.mrp || "Missing", status: parsed.mrp ? "PASS" : "FAIL" },
      net_quantity: { value: parsed.netQuantity || "Missing", status: parsed.netQuantity ? "PASS" : "FAIL" },
      usp: { declared: parsed.declaredUsp || computedUsp || "Missing", calculated: computedUsp || "N/A", status: (parsed.declaredUsp || computedUsp) ? "PASS" : "FAIL" },
      manufacturing_date: { value: parsed.mfgDate || "Missing", status: parsed.mfgDate ? "PASS" : "FAIL" }
    },
    intelligence: parsed.productIntelligence || "Product verified against Legal Metrology Schedule."
  };
};

const Layout = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={26} color="var(--primary)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>LegalLens AI</span>
              <span style={{ fontSize: '0.62rem', background: 'var(--primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}><Sparkles size={10}/> VISION</span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>SIH26034 Metrology Auditor</p>
          </div>
        </div>
        <button onClick={() => setIsDark(!isDark)} style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-main)', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main style={{ flex: 1, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ height: '100%' }}>
            {children}
          </motion.div>
        </AnimatePresence>
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
  return (
    <Link to={to} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: active ? 'var(--primary)' : 'var(--text-muted)', flex: 1 }}>
      {icon}
      <span style={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500 }}>{label}</span>
    </Link>
  );
};

const HomePage = () => {
  const navigate = useNavigate();

  const handleSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    navigate('/scan', { state: { directFile: file } });
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px', background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-input) 100%)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>Smart Vision Auditor</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Semantic packaging parsing powered by multimodal AI.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <input type="file" accept="image/jpeg, image/png" capture="environment" id="home-camera" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-camera" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}>
          <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '14px', borderRadius: '50%' }}>
            <Camera size={30} color="var(--primary)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Live Camera</span>
        </label>
        
        <input type="file" accept="image/jpeg, image/png" id="home-upload" style={{ display: 'none' }} onChange={handleSelection} />
        <label htmlFor="home-upload" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 10px', cursor: 'pointer' }}>
          <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '14px', borderRadius: '50%' }}>
            <Upload size={30} color="var(--primary)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Upload Image</span>
        </label>
      </div>
    </div>
  );
};

const ScanPage = () => {
  const location = useLocation();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (location.state?.directFile) {
      executeScan(location.state.directFile);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const saveAuditLog = (finalReport) => {
    const existing = JSON.parse(localStorage.getItem('legallens_logs') || '[]');
    localStorage.setItem('legallens_logs', JSON.stringify([
      { id: Date.now(), date: new Date().toLocaleString(), status: finalReport.status, product: finalReport.productName },
      ...existing
    ]));
  };

  const executeScan = async (file) => {
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setReport(null);
    setStatusMsg('Compressing & Preparing Image...');

    try {
      const base64Data = await fileToBase64(file);
      setStatusMsg('AI Vision Auditing in Progress...');
      
      const auditResult = await runGeminiVisionAudit(base64Data);
      setReport(auditResult);
      saveAuditLog(auditResult);

      if (auditResult.status === 'COMPLIANT') confetti();
    } catch (err) {
      alert(`Audit failed: ${err.message}`);
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

    doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.text("STATUTORY COMPLIANCE INSPECTION AUDIT", 105, 36, { align: "center" });
    doc.setLineWidth(0.4); doc.setDrawColor(203, 213, 225); doc.line(15, 40, 195, 40);

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Reference No: LM/PCR-${Date.now().toString().slice(-6)}`, 15, 48);
    doc.text(`Product Verified: ${report.productName}`, 15, 54);
    doc.text(`Inspection Time: ${new Date().toLocaleString()}`, 15, 60);

    const isPass = report.status === 'COMPLIANT';
    doc.setFillColor(isPass ? 220 : 254, isPass ? 252 : 226, isPass ? 231 : 226);
    doc.roundedRect(15, 66, 180, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); 
    doc.setTextColor(isPass ? 22 : 220, isPass ? 163 : 38, isPass ? 74 : 38);
    doc.text(`VERDICT: ${isPass ? 'COMPLIANT WITH PCR 2011' : 'STATUTORY CONTRAVENTION DETECTED'}`, 20, 74);

    doc.setTextColor(15, 23, 42); doc.setFontSize(9.5); doc.text("SCHEDULE OF MANDATORY DECLARATIONS:", 15, 88);
    let y = 95;
    [
      ["Maximum Retail Price (MRP)", report.checklist.mrp], 
      ["Net Quantity", report.checklist.net_quantity], 
      ["Unit Sale Price (USP)", report.checklist.usp], 
      ["Manufacturing / Batch", report.checklist.manufacturing_date]
    ].forEach(([k, v]) => {
      doc.setFont("helvetica", "normal"); doc.text(`• ${k}`, 20, y);
      doc.setFont("helvetica", "bold"); doc.text(`${v.value || v.declared} [${v.status}]`, 140, y); y += 8;
    });

    doc.save(`LegalLens_Notice_${Date.now()}.pdf`);
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!preview ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}>
          <Sparkles size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Scan Packaging</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>AI vision ignores glare, reflections, and reads curved labels cleanly.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="file" accept="image/jpeg, image/png" capture="environment" onChange={(e) => executeScan(e.target.files[0])} style={{ display: 'none' }} id="cam-input" />
            <label htmlFor="cam-input" style={{ background: 'var(--primary)', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={18}/> Camera</label>
            <input type="file" accept="image/jpeg, image/png" onChange={(e) => executeScan(e.target.files[0])} style={{ display: 'none' }} id="upload-input" />
            <label htmlFor="upload-input" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={18}/> Upload</label>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ position: 'relative', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Product Preview" />
            {loading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '12px', zIndex: 11, padding: '20px' }}>
                <Sparkles className="spinner" size={32} color="#60a5fa" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{statusMsg}</span>
              </div>
            )}
          </div>

          {!loading && report && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{report.productName}</h3>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{report.category}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: report.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)', fontWeight: 800, fontSize: '0.85rem' }}>
                  {report.status === 'COMPLIANT' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} {report.status}
                </div>
              </div>

              <div style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '0.76rem', lineHeight: 1.45, color: 'var(--text-main)', borderLeft: '3px solid var(--primary)' }}>
                <strong>Product Intelligence:</strong> {report.intelligence}
              </div>

              {report.violations.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--danger-bg)', padding: '10px', borderRadius: '8px' }}>
                  <strong>Compliance Observations:</strong>
                  {report.violations.map((v, i) => <span key={i}>• {v}</span>)}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Maximum Retail Price (MRP):</span><strong>{report.checklist.mrp.value}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Standard Net Quantity:</span><strong>{report.checklist.net_quantity.value}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Unit Sale Price (USP):</span><strong>{report.checklist.usp.declared}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}><span>Batch / Packaging Date:</span><strong>{report.checklist.manufacturing_date.value}</strong></div>
              </div>

              <button onClick={generatePDF} style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                <FileDown size={18} /> Export Statutory Notice (PDF)
              </button>

              <button onClick={() => setPreview(null)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}>
                Scan Another Product
              </button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Audit Logs</h2>
        <button onClick={() => { localStorage.removeItem('legallens_logs'); setLogs([]); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
      </div>
      {logs.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No local audits recorded yet.</p> : logs.map(log => (
        <div key={log.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{log.product}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{log.date}</span>
          </div>
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
      <div style={{ textAlign: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Team LegalLens</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SIH26034 - Legal Metrology Scanner</p>
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        {team.map((member, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{member.name}</span>
              <span style={{ fontSize: '0.62rem', background: member.role === 'LEADER' ? 'var(--primary)' : 'var(--bg-input)', color: member.role === 'LEADER' ? '#fff' : 'var(--text-muted)', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>{member.role.replace('_', ' ')}</span>
            </div>
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
