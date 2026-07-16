"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Crop,
  Download,
  FileImage,
  ImageIcon,
  LockKeyhole,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Step = "home" | "editor" | "templates" | "result";
type Tool = "convert" | "compress" | "resize" | "crop";
type OutputFormat = "jpeg" | "png" | "webp";

type ImageInfo = {
  file: File;
  url: string;
  width: number;
  height: number;
};

type ResultInfo = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  format: OutputFormat;
};

type Preset = {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  ratio: string;
  tone: string;
};

const tools = [
  { id: "convert" as Tool, name: "格式转换", detail: "JPG、PNG、WebP", icon: RefreshCw, color: "blue" },
  { id: "compress" as Tool, name: "压缩图片", detail: "精准控制体积", icon: Minimize2, color: "green" },
  { id: "resize" as Tool, name: "调整尺寸", detail: "自定义宽高", icon: Maximize2, color: "violet" },
  { id: "crop" as Tool, name: "模板裁剪", detail: "热门封面尺寸", icon: Crop, color: "orange" },
];

const presets: Preset[] = [
  { id: "video", name: "视频封面", category: "视频", width: 1280, height: 720, ratio: "16:9", tone: "blue" },
  { id: "social", name: "社交分享", category: "社交媒体", width: 1200, height: 630, ratio: "1.91:1", tone: "violet" },
  { id: "square", name: "方形头像", category: "社交媒体", width: 1080, height: 1080, ratio: "1:1", tone: "pink" },
  { id: "shop", name: "电商主图", category: "电商", width: 800, height: 800, ratio: "1:1", tone: "orange" },
  { id: "portrait", name: "竖版海报", category: "视频", width: 1080, height: 1440, ratio: "3:4", tone: "green" },
  { id: "id-photo", name: "标准证件照", category: "证件照", width: 295, height: 413, ratio: "5:7", tone: "slate" },
];

const formatLabel: Record<OutputFormat, string> = { jpeg: "JPG", png: "PNG", webp: "WebP" };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("浏览器无法导出该图片"))), type, quality);
  });
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [step, setStep] = useState<Step>("home");
  const [activeTool, setActiveTool] = useState<Tool>("compress");
  const [image, setImage] = useState<ImageInfo | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("jpeg");
  const [targetKB, setTargetKB] = useState(200);
  const [quality, setQuality] = useState(82);
  const [resizeWidth, setResizeWidth] = useState(1200);
  const [resizeHeight, setResizeHeight] = useState(800);
  const [ratioLocked, setRatioLocked] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(presets[0]);
  const [category, setCategory] = useState("社交媒体");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState(52);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pixel-workshop-theme");
    const next = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    setTheme(next);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("pixel-workshop-theme", theme);
  }, [theme]);

  const filteredPresets = useMemo(
    () => presets.filter((preset) => (category === "全部" || preset.category === category) && preset.name.includes(search.trim())),
    [category, search],
  );

  const openPicker = (tool?: Tool) => {
    if (tool) setActiveTool(tool);
    inputRef.current?.click();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setError("请选择有效的图片文件");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("首版单张图片最大支持 30 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const decoded = await loadImage(url);
      if (image?.url) URL.revokeObjectURL(image.url);
      if (result?.url) URL.revokeObjectURL(result.url);
      const info = { file, url, width: decoded.naturalWidth, height: decoded.naturalHeight };
      setImage(info);
      setResult(null);
      setResizeWidth(decoded.naturalWidth);
      setResizeHeight(decoded.naturalHeight);
      setOutputFormat(file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpeg");
      setStep(activeTool === "crop" ? "templates" : "editor");
    } catch {
      URL.revokeObjectURL(url);
      setError("当前浏览器无法读取该格式。HEIC/RAW 等专业格式将在服务端版本开放。");
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  const updateWidth = (value: number) => {
    if (!image) return;
    const safe = Math.max(1, Math.min(12000, value || 1));
    setResizeWidth(safe);
    if (ratioLocked) setResizeHeight(Math.round((safe / image.width) * image.height));
  };

  const updateHeight = (value: number) => {
    if (!image) return;
    const safe = Math.max(1, Math.min(12000, value || 1));
    setResizeHeight(safe);
    if (ratioLocked) setResizeWidth(Math.round((safe / image.height) * image.width));
  };

  const processImage = async () => {
    if (!image) return;
    setProcessing(true);
    setError("");
    try {
      const source = await loadImage(image.url);
      const isPreset = activeTool === "crop";
      const width = isPreset ? selectedPreset.width : activeTool === "resize" ? resizeWidth : image.width;
      const height = isPreset ? selectedPreset.height : activeTool === "resize" ? resizeHeight : image.height;
      const maxPixels = 36_000_000;
      if (width * height > maxPixels) throw new Error("输出分辨率过大，请控制在 3600 万像素以内");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: outputFormat !== "jpeg" });
      if (!context) throw new Error("无法创建图片处理画布");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (outputFormat === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      if (isPreset) {
        const sourceRatio = source.width / source.height;
        const targetRatio = width / height;
        let sx = 0;
        let sy = 0;
        let sw = source.width;
        let sh = source.height;
        if (sourceRatio > targetRatio) {
          sw = source.height * targetRatio;
          sx = (source.width - sw) / 2;
        } else {
          sh = source.width / targetRatio;
          sy = (source.height - sh) / 2;
        }
        context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
      } else {
        context.drawImage(source, 0, 0, width, height);
      }
      const mime = `image/${outputFormat}`;
      let blob: Blob;
      if (activeTool === "compress" && outputFormat !== "png") {
        const target = Math.max(10, targetKB) * 1024;
        let low = 0.08;
        let high = quality / 100;
        let best = await canvasToBlob(canvas, mime, high);
        let smallest = best;
        for (let i = 0; i < 9; i += 1) {
          const current = (low + high) / 2;
          const candidate = await canvasToBlob(canvas, mime, current);
          if (candidate.size < smallest.size) smallest = candidate;
          if (candidate.size <= target) {
            if (best.size > target || candidate.size > best.size) best = candidate;
            low = current;
          } else high = current;
        }
        blob = best.size <= target ? best : smallest;
      } else {
        blob = await canvasToBlob(canvas, mime, quality / 100);
      }
      if (result?.url) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob), width, height, format: outputFormat });
      setStep("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "处理失败，请换一张图片重试");
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result || !image) return;
    const anchor = document.createElement("a");
    const base = image.file.name.replace(/\.[^.]+$/, "") || "image";
    anchor.href = result.url;
    anchor.download = `${base}-pixel-workshop.${result.format === "jpeg" ? "jpg" : result.format}`;
    anchor.click();
  };

  const reset = () => {
    setStep("home");
    setMenuOpen(false);
    setError("");
  };

  const beginTool = (tool: Tool) => {
    setActiveTool(tool);
    if (image) setStep(tool === "crop" ? "templates" : "editor");
    else openPicker(tool);
  };

  const applyPreset = () => {
    setActiveTool("crop");
    setOutputFormat("jpeg");
    processImage();
  };

  const savedPercent = image && result ? Math.max(0, Math.round((1 - result.blob.size / image.file.size) * 100)) : 0;

  return (
    <main className="site-shell">
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/*,.heic,.heif" onChange={handleInput} />
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="返回首页">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /></span>
          <span>像素工坊</span>
        </button>
        <nav className="desktop-nav" aria-label="主要导航">
          <button onClick={() => beginTool("convert")}>格式转换</button>
          <button onClick={() => beginTool("compress")}>图片压缩</button>
          <button onClick={() => beginTool("resize")}>调整尺寸</button>
          <button onClick={() => beginTool("crop")}>封面模板</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}>
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="打开菜单">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menuOpen && (
          <div className="mobile-popover">
            {tools.map((tool) => <button key={tool.id} onClick={() => { beginTool(tool.id); setMenuOpen(false); }}>{tool.name}<ArrowRight size={16} /></button>)}
          </div>
        )}
      </header>

      {step === "home" && (
        <section className="home-view page-enter">
          <div className="hero-copy">
            <span className="eyebrow"><WandSparkles size={15} /> 免费、快速、无需上传</span>
            <h1>图片处理，<span>一步完成</span></h1>
            <p>转换格式、压缩体积、修改尺寸。所有常用工具，都在一个清爽的工作台里。</p>
          </div>

          <div className="upload-layout">
            <div className="upload-card" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
              <div className="upload-icon"><Upload size={30} /></div>
              <div>
                <h2>选择图片或拖到这里</h2>
                <p>支持 JPG、PNG、WebP 等浏览器可读取格式</p>
              </div>
              <button className="primary-button" onClick={() => openPicker()}><ImageIcon size={19} />选择图片</button>
              <span className="upload-limit">单张最大 30 MB · 图片仅在当前设备处理</span>
            </div>

            <div className="feature-grid">
              {tools.map(({ id, name, detail, icon: Icon, color }) => (
                <button className="feature-card" key={id} onClick={() => beginTool(id)}>
                  <span className={`feature-icon ${color}`}><Icon size={21} /></span>
                  <span><strong>{name}</strong><small>{detail}</small></span>
                  <ArrowRight className="feature-arrow" size={17} />
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <div className="trust-row">
            <span><ShieldCheck size={17} />本地处理，保护隐私</span>
            <span><SlidersHorizontal size={17} />画质与体积精细控制</span>
            <span><Sparkles size={17} />无需注册即可下载</span>
          </div>
        </section>
      )}

      {step === "editor" && image && (
        <section className="workspace page-enter">
          <div className="workspace-heading">
            <button className="back-button" onClick={reset}><ArrowLeft size={19} />返回</button>
            <div><h1>{image.file.name}</h1><p>{image.width}×{image.height} · {formatBytes(image.file.size)}</p></div>
            <button className="subtle-button" onClick={() => openPicker()}><RefreshCw size={16} />更换</button>
          </div>

          <div className="editor-grid">
            <div className="preview-panel">
              <div className="image-stage"><img src={image.url} alt="待处理图片预览" /></div>
              <div className="image-meta"><span><FileImage size={16} />原始图片</span><span>{image.width} × {image.height}</span></div>
            </div>

            <div className="controls-panel">
              <div className="tool-tabs" role="tablist">
                {tools.map(({ id, name, icon: Icon }) => (
                  <button key={id} className={activeTool === id ? "active" : ""} onClick={() => { setActiveTool(id); if (id === "crop") setStep("templates"); }} role="tab">
                    <Icon size={17} /><span>{name.replace("图片", "")}</span>
                  </button>
                ))}
              </div>

              <div className="control-body">
                {activeTool === "convert" && (
                  <div className="control-section">
                    <div className="section-title"><div><h2>输出格式</h2><p>选择最适合使用场景的格式</p></div></div>
                    <div className="format-options">
                      {(["jpeg", "png", "webp"] as OutputFormat[]).map((format) => (
                        <button key={format} className={outputFormat === format ? "selected" : ""} onClick={() => setOutputFormat(format)}>
                          <span>{formatLabel[format]}</span><small>{format === "jpeg" ? "兼容性最好" : format === "png" ? "支持透明" : "体积更小"}</small>{outputFormat === format && <Check size={17} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTool === "compress" && (
                  <div className="control-section">
                    <div className="section-title"><div><h2>压缩设置</h2><p>尽量接近目标体积并保留画质</p></div></div>
                    <label className="field-label">目标体积</label>
                    <div className="input-unit"><input type="number" min="10" max="30000" value={targetKB} onChange={(event) => setTargetKB(Number(event.target.value))} /><span>KB</span><ChevronDown size={15} /></div>
                    <div className="range-heading"><label htmlFor="quality">画质</label><span>{quality >= 90 ? "极佳" : quality >= 75 ? "推荐" : "较小"} · {quality}%</span></div>
                    <input id="quality" className="range" type="range" min="10" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} style={{ "--value": `${quality}%` } as React.CSSProperties} />
                    {outputFormat === "png" && <p className="helper">PNG 为无损格式，目标体积控制有限。需要更小体积可切换 WebP。</p>}
                  </div>
                )}

                {activeTool === "resize" && (
                  <div className="control-section">
                    <div className="section-title"><div><h2>图片尺寸</h2><p>输入新的像素宽高</p></div></div>
                    <div className="dimension-row">
                      <label>宽度<div className="number-field"><input type="number" value={resizeWidth} onChange={(event) => updateWidth(Number(event.target.value))} /><span>px</span></div></label>
                      <button className={`ratio-lock ${ratioLocked ? "active" : ""}`} onClick={() => setRatioLocked(!ratioLocked)} aria-label="锁定宽高比"><LockKeyhole size={16} /></button>
                      <label>高度<div className="number-field"><input type="number" value={resizeHeight} onChange={(event) => updateHeight(Number(event.target.value))} /><span>px</span></div></label>
                    </div>
                    <div className="quick-sizes">
                      {[25, 50, 75, 100].map((percent) => <button key={percent} onClick={() => updateWidth(Math.round(image.width * percent / 100))}>{percent}%</button>)}
                    </div>
                  </div>
                )}

                <div className="output-strip">
                  <div><small>原图</small><strong>{formatBytes(image.file.size)}</strong></div>
                  <ArrowRight size={19} />
                  <div><small>输出</small><strong>{formatLabel[outputFormat]}</strong></div>
                </div>
                {error && <div className="error-banner compact" role="alert">{error}</div>}
              </div>
              <div className="sticky-action"><button className="primary-button" onClick={processImage} disabled={processing}>{processing ? <><span className="spinner" />正在处理</> : <>开始处理<ArrowRight size={19} /></>}</button></div>
            </div>
          </div>
        </section>
      )}

      {step === "templates" && image && (
        <section className="workspace page-enter">
          <div className="workspace-heading">
            <button className="back-button" onClick={() => setStep("editor")}><ArrowLeft size={19} />返回编辑</button>
            <div><h1>选择封面尺寸</h1><p>一键适配常用内容平台</p></div>
          </div>
          <div className="template-layout">
            <div className="crop-preview-panel">
              <div className="crop-stage" style={{ aspectRatio: `${selectedPreset.width}/${selectedPreset.height}` }}>
                <img src={image.url} alt="模板裁剪预览" />
                <div className="safe-area"><span>安全区</span></div>
                <span className="ratio-badge">{selectedPreset.ratio}</span>
              </div>
              <div className="crop-caption"><div><strong>{selectedPreset.name}</strong><span>{selectedPreset.width} × {selectedPreset.height}</span></div><button><RotateCcw size={16} />重置位置</button></div>
            </div>
            <div className="template-panel">
              <div className="search-box"><Search size={18} /><input aria-label="搜索模板" placeholder="搜索尺寸名称" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <div className="category-chips">
                {["全部", "社交媒体", "视频", "电商", "证件照"].map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <div className="preset-list">
                {filteredPresets.map((preset) => (
                  <button className={`preset-card ${selectedPreset.id === preset.id ? "selected" : ""}`} key={preset.id} onClick={() => setSelectedPreset(preset)}>
                    <span className={`preset-thumb ${preset.tone}`}><ImageIcon size={22} /></span>
                    <span><strong>{preset.name}</strong><small>{preset.width} × {preset.height} · {preset.ratio}</small></span>
                    <span className="radio">{selectedPreset.id === preset.id && <Check size={14} />}</span>
                  </button>
                ))}
              </div>
              <div className="sticky-action"><button className="primary-button" onClick={applyPreset} disabled={processing}>{processing ? <><span className="spinner" />正在裁剪</> : <>应用此尺寸<ArrowRight size={19} /></>}</button></div>
            </div>
          </div>
        </section>
      )}

      {step === "result" && image && result && (
        <section className="result-view page-enter">
          <div className="success-heading"><span className="success-icon"><Check size={28} strokeWidth={2.8} /></span><div><span>处理成功</span><h1>图片已经准备好了</h1><p>请检查效果，然后下载到你的设备。</p></div></div>
          <div className="result-grid">
            <div className="compare-card">
              <div className="compare-stage">
                <img src={image.url} alt="原图" />
                <div className="after-layer" style={{ clipPath: `inset(0 0 0 ${compare}%)` }}><img src={result.url} alt="处理后图片" /></div>
                <div className="compare-line" style={{ left: `${compare}%` }}><span><ChevronDown size={16} /></span></div>
                <span className="compare-label before">原图</span><span className="compare-label after">处理后</span>
                <input aria-label="拖动比较处理前后" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} />
              </div>
              <p>拖动中间滑块，对比处理前后的细节</p>
            </div>
            <div className="result-panel">
              <div className="result-stats">
                <div><small>格式</small><strong>{formatLabel[result.format]}</strong></div>
                <div><small>尺寸</small><strong>{result.width}×{result.height}</strong></div>
                <div><small>体积</small><strong>{formatBytes(result.blob.size)}</strong></div>
                <div className="saving"><small>节省空间</small><strong>{savedPercent}%</strong></div>
              </div>
              <button className="primary-button download-button" onClick={downloadResult}><Download size={20} />下载图片</button>
              <button className="secondary-button" onClick={() => setStep("editor")}><RefreshCw size={17} />继续调整</button>
              <div className="next-actions"><p>继续处理这张图片</p><div>{tools.filter((tool) => tool.id !== activeTool).slice(0, 3).map(({ id, name, icon: Icon }) => <button key={id} onClick={() => beginTool(id)}><Icon size={18} />{name}</button>)}</div></div>
              <div className="privacy-note"><ShieldCheck size={17} /><span><strong>你的图片很安全</strong>全部处理都在浏览器本地完成，没有上传到服务器。</span></div>
            </div>
          </div>
          <button className="text-button" onClick={reset}>处理另一张图片</button>
        </section>
      )}
    </main>
  );
}
