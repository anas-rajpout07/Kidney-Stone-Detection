import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  FileImage,
  FlaskConical,
  FolderClock,
  Gauge,
  Grid2X2,
  Image as ImageIcon,
  Info,
  Layers3,
  Maximize2,
  Menu,
  Minus,
  Moon,
  MoreHorizontal,
  Move3d,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import {
  detectScan,
  downloadRecordPdf,
  getHistory,
  getRecord,
  getStats,
  modelInfo,
} from "@/lib/api";
import type {
  AnalysisStats,
  DetectionResult,
  HistoryRecord,
} from "@/types/analysis";

const BRAND_MARK = "/logo.png";
const HERO_IMAGE = "/manus-storage/kidneyai-hero_ba9617eb.png";
const SCAN_IMAGE = "/manus-storage/kidneyai-scan-card_6820f117.png";
const PIPELINE_IMAGE = "/manus-storage/kidneyai-pipeline_ec121689.png";
const DICOM_TEXTURE = "/manus-storage/kidneyai-dicom_2bf2b96e.png";

type Page = "dashboard" | "analysis" | "history" | "model" | "about";
type AnalysisMode = "idle" | "processing" | "result";
type ViewerTab = "detected" | "original" | "compare";

const pageMeta: Record<Page, { label: string; eyebrow: string }> = {
  dashboard: { label: "Dashboard", eyebrow: "Workspace overview" },
  analysis: { label: "New analysis", eyebrow: "CT scan workstation" },
  history: { label: "Analysis history", eyebrow: "Review previous scans" },
  model: { label: "Model information", eyebrow: "Detection system" },
  about: { label: "About KidneyAI", eyebrow: "Research demonstration" },
};

const navItems: { id: Page; label: string; icon: typeof Grid2X2 }[] = [
  { id: "dashboard", label: "Dashboard", icon: Grid2X2 },
  { id: "analysis", label: "New analysis", icon: ScanLine },
  { id: "history", label: "Analysis history", icon: FolderClock },
  { id: "model", label: "Model information", icon: BrainCircuit },
  { id: "about", label: "About KidneyAI", icon: CircleHelp },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (index = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.42, delay: index * 0.06 } }),
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function StatusDot({ label = "AI system ready" }: { label?: string }) {
  return (
    <span className="status-inline">
      <span className="status-pulse" aria-hidden="true" />
      {label}
    </span>
  );
}

function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? "brand-lockup-compact" : ""}`}>
      <span className="brand-mark">
        <img src={BRAND_MARK} alt="Logo" />
      </span>
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
          <div style={{ order: 1, lineHeight: "1.2" }}>
            <strong>Kidney</strong><b style={{ marginLeft: "6px" }}>AI</b>
          </div>
          {/* <small> tag hata kar <div> lagaya hai taake purani CSS isay upar na bhej sake */}
          <div style={{ order: 2, fontSize: "0.85em", lineHeight: "1.2", marginTop: "2px" }}>
            Clinical signal lab
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ page, setPage, open, setOpen }: { page: Page; setPage: (page: Page) => void; open: boolean; setOpen: (open: boolean) => void }) {
  return (
    <>
      <AnimatePresence>
        {open && <motion.button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-topline"><AppLogo /><button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={17} /></button></div>
        <div className="rail-status"><span className="status-pulse" /> <span>Demo environment</span><span className="status-version">v0.9</span></div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          {navItems.slice(0, 3).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => { setPage(id); setOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{page === id && <ChevronRight size={14} className="nav-arrow" />}
            </button>
          ))}
          <p className="nav-heading nav-heading-lower">System</p>
          {navItems.slice(3).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => { setPage(id); setOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{page === id && <ChevronRight size={14} className="nav-arrow" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="model-mini-card">
            <div className="model-mini-icon"><BrainCircuit size={16} /></div>
            <div><span>Active model</span><strong>YOLO detector</strong></div>
            <span className="ready-pill">Ready</span>
          </div>
          <p className="sidebar-footnote">Research demo only. Not for clinical diagnosis.</p>
        </div>
      </aside>
    </>
  );
}

function TopBar({ page, toggleTheme, theme, onMenu }: { page: Page; toggleTheme: () => void; theme: string; onMenu: () => void }) {
  const meta = pageMeta[page];
  return (
    <header className="topbar">
      <div className="topbar-leading"><div className="topbar-brand"><AppLogo compact /></div><button className="icon-btn mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button><div><p className="breadcrumb"><span>KidneyAI</span><ChevronRight size={13} /> {meta.eyebrow}</p><h1>{meta.label}</h1></div></div>
      <div className="topbar-actions"><div className="system-status"><StatusDot /></div><button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><div className="avatar" aria-label="Demo user">AR</div></div>
    </header>
  );
}

function SectionHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="section-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{action}</div>;
}

function StatCard({ icon: Icon, label, value, detail, accent, delay = 0 }: { icon: typeof Activity; label: string; value: string; detail: string; accent: string; delay?: number }) {
  return <motion.div className="stat-card" custom={delay} variants={fadeUp} initial="hidden" animate="visible"><div className="stat-card-top"><div className={`stat-icon ${accent}`}><Icon size={18} /></div><MoreHorizontal size={18} className="muted-icon" /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></motion.div>;
}

function Dashboard({ goToAnalysis, setPage, history, stats }: { goToAnalysis: () => void; setPage: (page: Page) => void; history: HistoryRecord[]; stats: AnalysisStats }) {
  return <motion.div className="page-stack" initial="hidden" animate="visible" variants={fadeUp}>
    <section className="dashboard-hero">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="signal-line" /> KidneyAI workstation <span className="hero-kicker-tag">LIVE DATA</span></div>
        <h2>Review the signal,<br /><em>not the noise.</em></h2>
        <p>Run an AI-assisted scan review on CT imagery using the YOLO kidney stone detection workflow. Clear evidence, structured results, and a path ready for the next model.</p>
        <div className="hero-actions"><button className="button button-primary" onClick={goToAnalysis}>Start new analysis <ArrowRight size={16} /></button><button className="button button-ghost" onClick={() => setPage("model")}>View model <ChevronRight size={15} /></button></div>
        <div className="hero-meta"><StatusDot label="YOLO model ready" /><span className="meta-divider" /> <span>SQLite history · records saved locally</span></div>
      </div>
      <div className="hero-visual"><img src={HERO_IMAGE} alt="Illustrated CT scan with AI detection signal overlays" /><div className="hero-visual-overlay" /><div className="scan-readout scan-readout-top"><span>SCAN INPUT</span><strong>AXIAL · 512 × 512</strong></div><div className="scan-readout scan-readout-bottom"><span className="readout-marker" /> DETECTION LAYER <strong>2 SIGNALS</strong></div><div className="hero-crosshair" /></div>
    </section>
    <div className="stat-grid"><StatCard icon={Activity} label="Analyses completed" value={String(stats.analysesCompleted)} detail="CTs reviewed · SQLite" accent="accent-cyan" delay={1} /><StatCard icon={Zap} label="Stones detected" value={String(stats.stonesDetected)} detail="Object regions · SQLite" accent="accent-seafoam" delay={2} /><StatCard icon={Gauge} label="Avg. detection confidence" value={`${stats.averageConfidence.toFixed(1)}%`} detail="YOLO signal · stored records" accent="accent-amber" delay={3} /><StatCard icon={ShieldCheck} label="System status" value="Ready" detail="SQLite service · active" accent="accent-navy" delay={4} /></div>
    <div className="dashboard-lower">
      <motion.section className="panel recent-panel" custom={5} variants={fadeUp} initial="hidden" animate="visible"><SectionHeader eyebrow="Workspace activity" title="Recent analyses" action={<button className="text-button" onClick={() => setPage("history")}>View history <ArrowRight size={14} /></button>} /><div className="analysis-list">{history.slice(0, 3).map((item, index) => <HistoryRow key={item.id} item={item} index={index} onClick={goToAnalysis} />)}</div></motion.section>
      <motion.section className="panel system-panel" custom={6} variants={fadeUp} initial="hidden" animate="visible"><div className="system-panel-head"><div><span className="eyebrow">Pipeline readiness</span><h3>Built for the next layer.</h3></div><div className="pipeline-badge"><span className="status-pulse" /> Live</div></div><div className="mini-pipeline"><div className="mini-step active"><span>01</span><strong>CT image</strong><small>Input</small></div><div className="pipeline-connector active" /><div className="mini-step active"><span>02</span><strong>YOLO</strong><small>Active</small></div><div className="pipeline-connector dashed" /><div className="mini-step future"><span>03</span><strong>U-Net</strong><small>Coming soon</small></div></div><button className="system-panel-link" onClick={() => setPage("model")}>Explore the AI pipeline <ArrowUpRightIcon /></button></motion.section>
    </div>
    <div className="disclaimer-bar"><Info size={15} /><span>This system is an AI-assisted research/demo tool and is not a substitute for professional medical diagnosis.</span><button onClick={() => setPage("about")}>Learn more</button></div>
  </motion.div>;
}

function ArrowUpRightIcon() { return <ArrowRight size={15} />; }

function HistoryRow({ item, index, onClick }: { item: HistoryRecord; index: number; onClick: () => void }) {
  return <button className="history-row" onClick={onClick}><span className="history-index">0{index + 1}</span><span className="history-file"><FileImage size={17} /><span><strong>{item.fileName}</strong><small>{item.analyzedAt}</small></span></span><span className={`status-tag ${item.status === "detected" ? "status-detected" : "status-clear"}`}>{item.status === "detected" ? `${item.stoneCount} stones detected` : "No stone detected"}</span><span className="history-confidence">{item.confidence.toFixed(1)}%</span><ChevronRight size={16} className="muted-icon" /></button>;
}

function UploadDropzone({ file, fileInfo, onFile, onClear, onSample, dragging, setDragging }: { file: File | null; fileInfo: { name: string; size: string; dimensions?: string } | null; onFile: (file: File) => void; onClear: () => void; onSample: () => void; dragging: boolean; setDragging: (value: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptFile = (candidate?: File) => { if (!candidate) return; const valid = ["image/png", "image/jpeg", "image/webp"].includes(candidate.type); if (!valid) { toast.error("Please upload a supported image format."); return; } if (candidate.size > 10 * 1024 * 1024) { toast.error("Please choose a smaller image. Maximum size is 10 MB."); return; } onFile(candidate); toast.success("CT scan loaded", { description: candidate.name }); };
  if (file && fileInfo) return <div className="upload-preview-card"><div className="preview-image-wrap"><img src={URL.createObjectURL(file)} alt="Selected CT scan preview" /><div className="preview-image-badge"><ImageIcon size={13} /> Original scan</div></div><div className="preview-file-meta"><div><span className="eyebrow">Selected file</span><h3>{fileInfo.name}</h3><p>{fileInfo.size}{fileInfo.dimensions && ` · ${fileInfo.dimensions}`}</p></div><div className="preview-actions"><button className="button button-ghost button-small" onClick={() => inputRef.current?.click()}>Replace</button><button className="icon-btn icon-btn-danger" onClick={onClear} aria-label="Remove selected file"><X size={17} /></button></div></div><input ref={inputRef} className="sr-only" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => acceptFile(event.target.files?.[0])} /></div>;
  return <div className={`upload-zone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}><input ref={inputRef} className="sr-only" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => acceptFile(event.target.files?.[0])} /><motion.div className="upload-icon-wrap" animate={{ y: dragging ? -4 : 0 }}><UploadCloud size={28} /></motion.div><h3>Upload CT scan</h3><p>Drag and drop an image here, or <strong>browse your device</strong>.</p><span className="upload-formats">PNG · JPG · JPEG · WEBP <i>· max 10 MB</i></span></div>;
}

function ProcessingState() {
  const steps = ["Preparing scan", "Processing image", "Running YOLO detection", "Generating visualization", "Finalizing results"];
  return <motion.div className="processing-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="processing-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><ScanLine size={28} /></div></div><div className="processing-copy"><span className="eyebrow">Analysis in progress</span><h2>Reading the scan signal.</h2><p>The demo workflow is processing the uploaded image and preparing a structured detection view.</p></div><div className="processing-steps">{steps.map((step, index) => <motion.div key={step} className={`process-step ${index < 2 ? "complete" : index === 2 ? "current" : ""}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.18 }}><span className="process-dot">{index < 2 ? <Check size={13} /> : index === 2 ? <span className="step-spinner" /> : <span />}</span><strong>{step}</strong><small>{index < 2 ? "Complete" : index === 2 ? "Working now" : "Queued"}</small></motion.div>)}</div><div className="processing-progress"><span /><small>Demo analysis · approximately 2 seconds</small></div></motion.div>;
}

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 43;
  const offset = circumference - (score / 100) * circumference;
  return <div className="score-gauge"><svg viewBox="0 0 110 110" aria-label={`${score}% AI detection confidence`}><circle className="gauge-track" cx="55" cy="55" r="43" /><motion.circle className="gauge-value" cx="55" cy="55" r="43" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.9, delay: 0.18 }} /></svg><div className="gauge-label"><strong>{score.toFixed(1)}<small>%</small></strong><span>AI confidence</span></div></div>;
}

function ResultViewer({
  result,
  tab,
  setTab,
}: {
  result: DetectionResult;
  tab: ViewerTab;
  setTab: (tab: ViewerTab) => void;
}) {
  const [zoom, setZoom] = useState(1);

  const originalImage = result.originalImageUrl || SCAN_IMAGE;
  const detectedImage = result.detectedImageUrl || originalImage;

  const displayedImage =
    tab === "detected" ? detectedImage : originalImage;

  const download = () => {
    const link = document.createElement("a");

    link.href = tab === "detected" ? detectedImage : originalImage;
    link.download = `kidneyai-${result.fileName}`;
    link.click();

    toast.success("Download started", {
      description: "The scan image is being saved.",
    });
  };

  const reset = () => setZoom(1);

  return (
    <section className="result-viewer panel">
      <div className="viewer-heading">
        <div>
          <span className="eyebrow">Visual evidence</span>
          <h3>Scan review</h3>
        </div>

        <div className="viewer-tools">
          <button
            className="icon-btn"
            onClick={() =>
              setZoom((value) => Math.min(value + 0.15, 1.8))
            }
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>

          <span className="zoom-value">
            {Math.round(zoom * 100)}%
          </span>

          <button
            className="icon-btn"
            onClick={() =>
              setZoom((value) => Math.max(value - 0.15, 0.7))
            }
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>

          <button
            className="icon-btn"
            onClick={reset}
            aria-label="Reset zoom"
          >
            <RotateCcw size={16} />
          </button>

          <button
            className="icon-btn"
            onClick={download}
            aria-label="Download result"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <div className="viewer-tabs" role="tablist">
        <button
          className={tab === "detected" ? "active" : ""}
          onClick={() => setTab("detected")}
          role="tab"
          aria-selected={tab === "detected"}
        >
          AI detection result
        </button>

        <button
          className={tab === "original" ? "active" : ""}
          onClick={() => setTab("original")}
          role="tab"
          aria-selected={tab === "original"}
        >
          Original scan
        </button>

        <button
          className={tab === "compare" ? "active" : ""}
          onClick={() => setTab("compare")}
          role="tab"
          aria-selected={tab === "compare"}
        >
          Compare
        </button>
      </div>

      <div
        className={`viewer-canvas ${
          tab === "compare" ? "canvas-compare" : ""
        }`}
      >
        {tab === "compare" ? (
          <>
            <ViewerImage
              src={originalImage}
              alt="Original CT scan"
              label="Original scan"
              zoom={zoom}
            />

            <ViewerImage
              src={detectedImage}
              alt="AI detection result"
              label="AI detection result"
              zoom={zoom}
            />
          </>
        ) : (
          <ViewerImage
            src={displayedImage}
            alt={
              tab === "detected"
                ? "CT scan with AI detection overlays"
                : "Original CT scan"
            }
            label={
              tab === "detected"
                ? "Detection layer"
                : "Original scan"
            }
            zoom={zoom}
          />
        )}
      </div>

      <div className="viewer-footer">
        <span>
          <Move3d size={14} /> Scroll to pan · controls preserve scan
          proportions
        </span>

        {tab !== "original" && (
          <span>
            <span className="legend-dot" /> Detection overlay
          </span>
        )}
      </div>
    </section>
  );
}

function ViewerImage({
  src,
  alt,
  label,
  zoom,
}: {
  src: string;
  alt: string;
  label: string;
  zoom: number;
}) {
  return (
    <div className="viewer-image-pane">
      <div className="viewer-label">
        <span>{label}</span>
        <span>Model output</span>
      </div>

      <div className="viewer-image-stage">
        <div
          className="viewer-image-inner"
          style={{ transform: `scale(${zoom})` }}
        >
          <img src={src} alt={alt} />
        </div>

        <div className="viewer-crosshair" />
      </div>
    </div>
  );
}
function ResultView({ result, onAnother, onDownloadPdf }: { result: DetectionResult; onAnother: () => void; onDownloadPdf: () => void }) {
  const [tab, setTab] = useState<ViewerTab>("detected");
  return <motion.div className="page-stack result-page" initial="hidden" animate="visible" variants={fadeUp}><div className="result-header"><div><div className="result-success"><CheckCircle2 size={16} /> Detection completed successfully</div><span className="eyebrow">Analysis results</span><h2>Detection results</h2><p>AI-assisted kidney stone detection analysis for <strong>{result.fileName}</strong>.</p></div><div className="result-actions"><button className="button button-ghost" onClick={onAnother}><RotateCcw size={15} /> Analyze another</button><button className="button button-primary" onClick={onDownloadPdf} disabled={!result.recordId}><Download size={15} /> Download PDF</button></div></div><div className="result-meta-row"><span><Clock3 size={14} /> {result.analyzedAt}</span><span><FileImage size={14} /> {result.fileName}</span><span><StatusDot label="Stored SQLite record" /></span></div><div className="result-summary-grid"><ResultMetric label="Detection status" value={result.status === "detected" ? "Stone detected" : "No stone detected"} detail={`${result.stoneCount} region${result.stoneCount === 1 ? "" : "s"} identified`} tone="status" /><ResultMetric label="Stones detected" value={String(result.stoneCount).padStart(2, "0")} detail="Object count" tone="cyan" /><ResultMetric label="Average confidence" value={`${result.averageConfidence.toFixed(1)}%`} detail="AI model signal" tone="seafoam" /><ResultMetric label="Highest confidence" value={`${result.highestConfidence.toFixed(1)}%`} detail="Detection #1" tone="amber" /></div><div className="result-main-grid"><ResultViewer result={result} tab={tab} setTab={setTab} /><aside className="result-evidence-rail"><section className="panel confidence-panel"><div className="panel-label-row"><div><span className="eyebrow">Signal quality</span><h3>AI detection confidence</h3></div><Gauge size={17} className="muted-icon" /></div><ScoreGauge score={result.averageConfidence} /><div className="confidence-scale"><span>0</span><span>50</span><span>100</span></div><p>Confidence represents the model's detection signal. It is not a medical diagnosis probability.</p></section><DetectionDetails detections={result.detections} /><ModelMini /></aside></div><section className="panel detection-table-panel"><SectionHeader eyebrow="Structured output" title="Detected stones" copy="Bounding boxes returned by the demo detection response." /><div className="detection-table-wrap"><table className="detection-table"><thead><tr><th>Detection</th><th>Class</th><th>Confidence</th><th>Bounding box</th><th>Signal</th></tr></thead><tbody>{result.detections.map((detection) => <tr key={detection.id}><td><span className="table-number">#{detection.id}</span></td><td>{detection.className}</td><td><strong>{detection.confidence.toFixed(1)}%</strong></td><td><code>{detection.bbox.x}, {detection.bbox.y} · {detection.bbox.width} × {detection.bbox.height}</code></td><td><span className="table-signal"><span /> High</span></td></tr>)}</tbody></table></div></section><div className="disclaimer-bar"><Info size={15} /><span>This system is an AI-assisted research/demo tool and is not a substitute for professional medical diagnosis.</span></div></motion.div>;
}

function ResultMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`result-metric result-${tone}`}><span className="stat-label">{label}</span><strong>{value}</strong><span>{detail}</span></div>; }
function DetectionDetails({ detections }: { detections: DetectionResult["detections"] }) { return <section className="panel detail-panel"><div className="panel-label-row"><div><span className="eyebrow">Detection detail</span><h3>Signal regions</h3></div><Copy size={16} className="muted-icon" /></div><div className="detail-list">{detections.map((detection) => <div className="detail-item" key={detection.id}><div className="detail-top"><span className="detail-id">#{detection.id}</span><strong>{detection.confidence.toFixed(1)}%</strong></div><div className="detail-body"><span>{detection.className}</span><code>x{detection.bbox.x} y{detection.bbox.y}</code></div></div>)}</div></section>; }
function ModelMini() { return <section className="panel model-result-mini"><div className="panel-label-row"><div><span className="eyebrow">Model</span><h3>YOLO detector</h3></div><BrainCircuit size={16} className="muted-icon" /></div><div className="model-mini-row"><span>Task</span><strong>Object detection</strong></div><div className="model-mini-row"><span>Input</span><strong>CT scan image</strong></div><div className="model-ready"><span className="status-pulse" /> Active model</div></section>; }

function NewAnalysis({ result, setResult, goToPage, onDownloadPdf }: { result: DetectionResult | null; setResult: (result: DetectionResult | null) => void; goToPage?: (page: Page) => void; onDownloadPdf: () => void }) {
  const [mode, setMode] = useState<AnalysisMode>(result ? "result" : "idle");
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; dimensions?: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const chooseFile = (selected: File) => { setFile(selected); setFileInfo({ name: selected.name, size: formatBytes(selected.size) }); const url = URL.createObjectURL(selected); setPreviewUrl(url); setResult(null); setMode("idle"); };
  const useSample = () => { setFile(null); setFileInfo({ name: "CT_Scan_001.jpg", size: "2.4 MB", dimensions: "512 × 512 px" }); setPreviewUrl(SCAN_IMAGE); setResult(null); setMode("idle"); toast.success("Sample scan loaded", { description: "Ready for a demo analysis." }); };
  const clear = () => { setFile(null); setFileInfo(null); setPreviewUrl(""); setResult(null); setMode("idle"); };
  const analyze = async () => {
    if (!file) {
      toast.error("Select a CT scan before analysis.");
      return;
    }
    setMode("processing");
    try {
      const response = await detectScan(file);
      setResult(response);
      setMode("result");
      toast.success("Analysis completed", { description: `${response.stoneCount} signal regions identified.` });
    } catch (err) {
      setMode("idle");
      toast.error(err instanceof Error ? err.message : "Analysis failed. Is the backend running?");
    }
  };
  if (mode === "result" && result) return <ResultView result={result} onAnother={clear} onDownloadPdf={onDownloadPdf} />;
  return <motion.div className="page-stack analysis-page" initial="hidden" animate="visible" variants={fadeUp}>{mode === "processing" ? <ProcessingState /> : <><section className="analysis-intro"><div><span className="eyebrow">Step 01 · Upload input</span><h2>Start a new scan review.</h2><p>Bring a CT image into the workstation. The demo will return a structured YOLO detection view with bounding boxes and confidence signals.</p></div><div className="analysis-mode-note"><ScanLine size={17} /><span><strong>YOLO detection</strong><small>Current active workflow</small></span></div></section><div className="analysis-workspace"><section className="panel upload-panel"><div className="panel-topline"><div><span className="eyebrow">CT scan input</span><h3>{fileInfo ? "Review selected scan" : "Upload CT scan"}</h3></div><span className="step-index">01 / 03</span></div>{fileInfo && previewUrl ? <div className="upload-preview-card"><div className="preview-image-wrap"><img src={previewUrl} alt="Selected CT scan preview" /><div className="preview-image-badge"><ImageIcon size={13} /> Original scan</div></div><div className="preview-file-meta"><div><span className="eyebrow">Selected file</span><h3>{fileInfo.name}</h3><p>{fileInfo.size}{fileInfo.dimensions && ` · ${fileInfo.dimensions}`}</p></div><div className="preview-actions"><label className="button button-ghost button-small">Replace<input className="sr-only" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => { const next = event.target.files?.[0]; if (next) chooseFile(next); }} /></label><button className="icon-btn icon-btn-danger" onClick={clear} aria-label="Remove selected file"><X size={17} /></button></div></div></div> : <UploadDropzone file={file} fileInfo={fileInfo} onFile={chooseFile} onClear={clear} onSample={useSample} dragging={dragging} setDragging={setDragging} />}<div className="upload-panel-footer"><span><ShieldCheck size={14} /> Uploaded image · result saved to SQLite</span><span>Supported: PNG, JPG, WEBP</span></div></section><aside className="panel workflow-panel"><div className="panel-topline"><div><span className="eyebrow">What you will receive</span><h3>Detection output</h3></div><Sparkles size={17} className="signal-icon" /></div><div className="workflow-output-list"><div><span className="workflow-output-icon"><ScanLine size={16} /></span><span><strong>Detection status</strong><small>Detected or not detected</small></span></div><div><span className="workflow-output-icon"><BarChart3 size={16} /></span><span><strong>Confidence signals</strong><small>Average and highest score</small></span></div><div><span className="workflow-output-icon"><Layers3 size={16} /></span><span><strong>Bounding boxes</strong><small>Coordinates for each region</small></span></div><div><span className="workflow-output-icon"><ImageIcon size={16} /></span><span><strong>Visual evidence</strong><small>Original and detected view</small></span></div></div><div className="workflow-cta"><span className="step-index">02 / 03</span><p>Ready when your scan is selected.</p><button className="button button-primary button-full" disabled={!fileInfo} onClick={analyze}><Zap size={16} /> Analyze CT scan</button></div></aside></div><div className="analysis-footnote"><span className="signal-line" /> <strong>Saved:</strong> Detection output and images are stored in the SQLite analysis history.</div></>}</motion.div>;
}

function HistoryPage({ records, loading, setPage, onOpenRecord }: { records: HistoryRecord[]; loading: boolean; setPage: (page: Page) => void; onOpenRecord: (item: HistoryRecord) => void }) {
  const [search, setSearch] = useState("");
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((item) => item.fileName.toLowerCase().includes(query));
  }, [records, search]);

  return <motion.div className="page-stack" initial="hidden" animate="visible" variants={fadeUp}>
    <section className="history-intro"><div><span className="eyebrow">Review workspace</span><h2>Analysis history.</h2><p>Stored SQLite records are shown here. Select a record to reopen its saved images, scores, and prediction details.</p></div><button className="button button-primary" onClick={() => setPage("analysis")}><ScanLine size={16} /> New analysis</button></section>
    <section className="panel history-page-panel"><div className="history-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scan names" aria-label="Search scan names" /></div><button className="button button-ghost button-small"><Clock3 size={15} /> Recent first</button></div><div className="history-table-header"><span>Scan</span><span>Status</span><span>Confidence</span><span /></div><div className="history-page-list">{loading ? <div className="empty-state-note"><FolderClock size={18} /><span>Loading saved analyses…</span></div> : filteredRecords.length === 0 ? <div className="empty-state-note"><FolderClock size={18} /><span>No saved analysis records yet. Run a new analysis to create the first record.</span></div> : filteredRecords.map((item) => <button className="history-page-row" key={item.id} onClick={() => onOpenRecord(item)}><span className="history-file"><span className="history-file-thumb"><FileImage size={18} /></span><span><strong>{item.fileName}</strong><small>{item.analyzedAt}</small></span></span><span className={`status-tag ${item.status === "detected" ? "status-detected" : "status-clear"}`}>{item.status === "detected" ? `${item.stoneCount} stones detected` : "No stone detected"}</span><strong className="history-page-score">{item.confidence.toFixed(1)}%</strong><ChevronRight size={17} className="muted-icon" /></button>)}</div></section>
    <div className="empty-state-note"><FolderClock size={18} /><span>Each completed analysis is saved in SQLite and can be downloaded as a PDF from its result view.</span></div>
  </motion.div>;
}

function ModelPage({ setPage }: { setPage: (page: Page) => void }) {
  return <motion.div className="page-stack" initial="hidden" animate="visible" variants={fadeUp}><section className="model-hero panel"><div className="model-hero-copy"><span className="eyebrow">System architecture</span><h2>One active model.<br /><em>A clear path ahead.</em></h2><p>KidneyAI currently demonstrates YOLO-based object detection. The interface keeps a deliberate seam for future kidney segmentation without making unavailable functionality appear live.</p><button className="button button-primary" onClick={() => setPage("analysis")}><ScanLine size={16} /> Run a demo analysis</button></div><div className="model-hero-visual"><img src={PIPELINE_IMAGE} alt="Abstract medical AI pipeline illustration" /><div className="model-overlay-label"><span className="status-pulse" /> Pipeline mapped</div></div></section><div className="model-detail-grid"><section className="panel model-spec-panel"><SectionHeader eyebrow="Current model" title={modelInfo.name} copy="The response contract is shaped for future Flask integration." /><div className="spec-grid"><Spec label="Model type" value={modelInfo.type} /><Spec label="Task" value={modelInfo.task} /><Spec label="Input" value={modelInfo.input} /><Spec label="Output" value={modelInfo.output} /></div><div className="active-model-strip"><span className="status-pulse" /><div><strong>Active and ready</strong><small>Mock service available in demo mode</small></div><span className="ready-pill">YOLO</span></div></section><section className="panel future-model-panel"><div className="future-tag">COMING SOON</div><div className="future-icon"><FlaskConical size={20} /></div><span className="eyebrow">Future model</span><h3>U-Net kidney segmentation</h3><p>A planned preprocessing stage for kidney crop visualization before YOLO detection. The UI is prepared for it, but the model is not active.</p><div className="future-flow"><span>CT scan</span><ChevronRight size={14} /><span className="future-node">U-Net</span><ChevronRight size={14} /><span>Kidney crop</span></div></section></div><section className="panel pipeline-section"><SectionHeader eyebrow="AI analysis pipeline" title="From image to evidence" copy="Current and future stages share the same structured result boundary." /><div className="full-pipeline"><PipelineStep index="01" title="CT scan" detail="Image input" active /><PipelineConnector active /><PipelineStep index="02" title="YOLO detection" detail="Active now" active /><PipelineConnector future /><PipelineStep index="03" title="U-Net segmentation" detail="Coming soon" future /><PipelineConnector future /><PipelineStep index="04" title="Final results" detail="Evidence view" /></div></section></motion.div>;
}
function Spec({ label, value }: { label: string; value: string }) { return <div className="spec-item"><span>{label}</span><strong>{value}</strong></div>; }
function PipelineStep({ index, title, detail, active, future }: { index: string; title: string; detail: string; active?: boolean; future?: boolean }) { return <div className={`pipeline-step ${active ? "active" : ""} ${future ? "future" : ""}`}><span>{index}</span><strong>{title}</strong><small>{detail}</small></div>; }
function PipelineConnector({ active, future }: { active?: boolean; future?: boolean }) { return <div className={`full-pipeline-connector ${active ? "active" : ""} ${future ? "future" : ""}`}><span /></div>; }

function AboutPage({ setPage }: { setPage: (page: Page) => void }) {
  return <motion.div className="page-stack" initial="hidden" animate="visible" variants={fadeUp}><section className="about-hero"><div className="about-copy"><span className="eyebrow">A research demonstration</span><h2>Make the model boundary<br /><em>easy to see.</em></h2><p>KidneyAI is a frontend experience for exploring AI-assisted kidney stone detection from CT scan images. It is designed to show the workflow clearly while leaving clinical interpretation to qualified professionals.</p><div className="about-actions"><button className="button button-primary" onClick={() => setPage("analysis")}><ScanLine size={16} /> Open workstation</button><button className="button button-ghost" onClick={() => setPage("model")}>See architecture <ArrowRight size={15} /></button></div></div><div className="about-mark-panel"><img src={BRAND_MARK} alt="KidneyAI symbol" /><span>KidneyAI</span><small>Signal over noise.</small></div></section><div className="about-grid"><section className="panel about-flow-panel"><SectionHeader eyebrow="Current workflow" title="The active path" /><div className="about-flow"><FlowItem number="01" label="CT image" /><FlowArrow /><FlowItem number="02" label="YOLO detection" active /><FlowArrow /><FlowItem number="03" label="Visualization" /><FlowArrow /><FlowItem number="04" label="Results" /></div></section><section className="panel about-principles"><span className="eyebrow">Product principles</span><div className="principle"><ShieldCheck size={17} /><span><strong>Transparent by design</strong><small>Confidence is labeled as a model signal, never a diagnosis.</small></span></div><div className="principle"><Layers3 size={17} /><span><strong>Ready to extend</strong><small>Future U-Net segmentation has a visible, non-functional home.</small></span></div><div className="principle"><ScanLine size={17} /><span><strong>Evidence first</strong><small>Original image, detection layer, and coordinates stay close together.</small></span></div></section></div><section className="panel about-disclaimer"><div className="disclaimer-icon"><Info size={19} /></div><div><span className="eyebrow">Medical disclaimer</span><h3>For research and demonstration only.</h3><p>This system is an AI-assisted research/demo tool and is not a substitute for professional medical diagnosis. It does not provide certified clinical interpretation, and its confidence scores should not be read as patient diagnosis probabilities.</p></div></section><footer className="about-footer"><span>KidneyAI · frontend demo</span><span>Designed for a future Flask REST API</span></footer></motion.div>;
}
function FlowItem({ number, label, active }: { number: string; label: string; active?: boolean }) { return <div className={`flow-item ${active ? "active" : ""}`}><span>{number}</span><strong>{label}</strong></div>; }
function FlowArrow() { return <ChevronRight className="flow-arrow" size={16} />; }

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [stats, setStats] = useState<AnalysisStats>({ analysesCompleted: 0, stonesDetected: 0, averageConfidence: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const { theme, toggleTheme = () => {} } = useTheme();
  const navigate = (next: Page) => { setPage(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const refreshStoredData = async () => {
    setHistoryLoading(true);
    try {
      const [nextHistory, nextStats] = await Promise.all([getHistory(), getStats()]);
      setHistory(nextHistory);
      setStats(nextStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load saved analysis records.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void refreshStoredData();
  }, [result?.recordId]);

  const openRecord = async (item: HistoryRecord) => {
    try {
      const storedResult = await getRecord(item.id);
      setResult(storedResult);
      navigate("analysis");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open this saved record.");
    }
  };

  const downloadPdf = async () => {
    if (!result?.recordId) {
      toast.error("This result has no saved database record yet.");
      return;
    }
    try {
      await downloadRecordPdf(result.recordId, result.fileName);
      toast.success("PDF download started", { description: "The image, score, and prediction records are included." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the PDF report.");
    }
  };

  const content = useMemo(() => {
    if (page === "dashboard") return <Dashboard goToAnalysis={() => navigate("analysis")} setPage={navigate} history={history} stats={stats} />;
    if (page === "analysis") return <NewAnalysis result={result} setResult={setResult} goToPage={navigate} onDownloadPdf={downloadPdf} />;
    if (page === "history") return <HistoryPage records={history} loading={historyLoading} setPage={navigate} onOpenRecord={openRecord} />;
    if (page === "model") return <ModelPage setPage={navigate} />;
    return <AboutPage setPage={navigate} />;
  }, [page, result, history, stats, historyLoading]);
  return <div className="app-shell"><Sidebar page={page} setPage={navigate} open={sidebarOpen} setOpen={setSidebarOpen} /><div className="app-main"><TopBar page={page} theme={theme} toggleTheme={toggleTheme} onMenu={() => setSidebarOpen(true)} /><main className="main-content">{content}</main><div className="mobile-bottom-bar"><button onClick={() => navigate("dashboard")} className={page === "dashboard" ? "active" : ""}><Grid2X2 size={18} /><span>Home</span></button><button onClick={() => navigate("analysis")} className={page === "analysis" ? "active" : ""}><ScanLine size={18} /><span>Analyze</span></button><button onClick={() => navigate("history")} className={page === "history" ? "active" : ""}><FolderClock size={18} /><span>History</span></button><button onClick={() => setSidebarOpen(true)}><MoreHorizontal size={18} /><span>More</span></button></div></div></div>;
}
