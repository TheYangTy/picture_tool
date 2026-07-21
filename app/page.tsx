"use client";

import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Check,
  ChevronDown,
  Crop,
  Download,
  FileImage,
  ImageIcon,
  Images,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { padImageBlob } from "./image-padding";
import { createZipBlob } from "./zip";

type Step = "home" | "editor" | "batch" | "templates" | "result";
type Tool = "convert" | "compress" | "resize" | "crop";
type OutputFormat = "jpeg" | "png" | "webp";
type SizeMode = "compress" | "enlarge";

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
  sizeMode?: SizeMode;
};

type Preset = {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  ratio: string;
  tone: string;
  note: string;
  verifiedAt: string;
};

type BatchStatus = "ready" | "processing" | "done" | "error";

type BatchItem = ImageInfo & {
  id: string;
  status: BatchStatus;
  result?: Blob;
  resultWidth?: number;
  resultHeight?: number;
  error?: string;
};

const tools = [
  { id: "convert" as Tool, name: "格式转换", detail: "JPG、PNG、WebP", icon: RefreshCw, color: "blue" },
  { id: "compress" as Tool, name: "文件体积", detail: "压缩或增大体积", icon: Minimize2, color: "green" },
  { id: "resize" as Tool, name: "调整尺寸", detail: "自定义宽高", icon: Maximize2, color: "violet" },
  { id: "crop" as Tool, name: "模板裁剪", detail: "热门封面尺寸", icon: Crop, color: "orange" },
];

const presets: Preset[] = [
  { id: "douyin-cover", name: "抖音主页封面", category: "抖音", width: 1080, height: 1440, ratio: "3:4", tone: "slate", note: "主页信息流常用可见比例", verifiedAt: "2026-07-17" },
  { id: "douyin-video", name: "抖音竖版视频", category: "抖音", width: 1080, height: 1920, ratio: "9:16", tone: "blue", note: "竖版视频与故事画布", verifiedAt: "2026-07-17" },
  { id: "xiaohongshu-note", name: "小红书图文封面", category: "小红书", width: 1080, height: 1440, ratio: "3:4", tone: "pink", note: "图文笔记推荐竖版比例", verifiedAt: "2026-07-17" },
  { id: "xiaohongshu-video", name: "小红书视频封面", category: "小红书", width: 1080, height: 1920, ratio: "9:16", tone: "orange", note: "沉浸式竖版视频画布", verifiedAt: "2026-07-17" },
  { id: "wechat-featured", name: "公众号首条封面", category: "微信", width: 900, height: 383, ratio: "2.35:1", tone: "green", note: "公众号首条大图封面", verifiedAt: "2026-07-17" },
  { id: "wechat-secondary", name: "公众号次条小图", category: "微信", width: 500, height: 500, ratio: "1:1", tone: "green", note: "次条消息方形封面", verifiedAt: "2026-07-17" },
  { id: "wechat-moments", name: "朋友圈主页封面", category: "微信", width: 1080, height: 1920, ratio: "9:16", tone: "green", note: "展开长图，主体放中部安全区", verifiedAt: "2026-07-17" },
  { id: "video", name: "通用视频封面", category: "通用", width: 1280, height: 720, ratio: "16:9", tone: "blue", note: "适合横版视频与播放器", verifiedAt: "2026-07-17" },
  { id: "social", name: "网页社交分享", category: "通用", width: 1200, height: 630, ratio: "1.91:1", tone: "violet", note: "适合链接预览与文章分享", verifiedAt: "2026-07-17" },
  { id: "square", name: "通用方形头像", category: "通用", width: 1080, height: 1080, ratio: "1:1", tone: "pink", note: "头像、方形帖子与商品图", verifiedAt: "2026-07-17" },
  { id: "shop", name: "电商主图", category: "电商", width: 800, height: 800, ratio: "1:1", tone: "orange", note: "通用方形商品主图", verifiedAt: "2026-07-17" },
  { id: "id-photo", name: "标准证件照", category: "证件照", width: 295, height: 413, ratio: "5:7", tone: "slate", note: "常用电子证件照比例", verifiedAt: "2026-07-17" },
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
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("jpeg");
  const [sizeMode, setSizeMode] = useState<SizeMode>("compress");
  const [targetKB, setTargetKB] = useState(200);
  const [quality, setQuality] = useState(82);
  const [resizeWidth, setResizeWidth] = useState(1200);
  const [resizeHeight, setResizeHeight] = useState(800);
  const [ratioLocked, setRatioLocked] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(presets[0]);
  const [category, setCategory] = useState("抖音");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState(52);

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
      const detectedFormat: OutputFormat = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpeg";
      setOutputFormat(activeTool === "compress" && detectedFormat === "png" ? "webp" : detectedFormat);
      setStep(activeTool === "crop" ? "templates" : "editor");
    } catch {
      URL.revokeObjectURL(url);
      setError("当前浏览器无法读取该格式。HEIC/RAW 等专业格式将在服务端版本开放。");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.hostname !== "localhost" || params.get("qa") !== "compression") return;
    const sample = document.createElement("canvas");
    sample.width = 1200;
    sample.height = 900;
    const context = sample.getContext("2d");
    if (!context) return;
    const pixels = context.createImageData(sample.width, sample.height);
    let seed = 20260717;
    for (let index = 0; index < pixels.data.length; index += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      pixels.data[index] = seed & 255;
      pixels.data[index + 1] = (seed >>> 8) & 255;
      pixels.data[index + 2] = (seed >>> 16) & 255;
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    sample.toBlob((blob) => {
      if (blob) handleFile(new File([blob], "qa-compression-sample.png", { type: "image/png" }));
    }, "image/png");
    // Local-only deterministic QA entry; production hosts never execute it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length === 1) {
      await handleFile(files[0]);
      return;
    }

    setError("");
    const candidates = files.slice(0, 20).filter((file) => file.type.startsWith("image/") && file.size <= 30 * 1024 * 1024);
    const loaded = await Promise.all(candidates.map(async (file, index) => {
      const url = URL.createObjectURL(file);
      try {
        const decoded = await loadImage(url);
        return {
          id: `${Date.now()}-${index}-${file.name}`,
          file,
          url,
          width: decoded.naturalWidth,
          height: decoded.naturalHeight,
          status: "ready" as BatchStatus,
        };
      } catch {
        URL.revokeObjectURL(url);
        return null;
      }
    }));
    const valid = loaded.filter((item): item is BatchItem => Boolean(item));
    if (!valid.length) {
      setError("没有找到当前浏览器可以读取的图片");
      return;
    }
    batchItems.forEach((item) => URL.revokeObjectURL(item.url));
    setBatchItems(valid);
    if (activeTool === "crop") setActiveTool("convert");
    setStep("batch");
    if (files.length > 20) setError("一次最多处理 20 张，已载入前 20 张中的有效图片");
    else if (valid.length < files.length) setError("部分图片因格式不支持或超过 30 MB 未载入");
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void handleFiles(Array.from(event.dataTransfer.files ?? []));
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

  const selectSizeMode = (mode: SizeMode) => {
    setSizeMode(mode);
    if (mode === "enlarge" && image) {
      setTargetKB(Math.min(60_000, Math.ceil(image.file.size / 1024) + 512));
    }
  };

  const processImage = async () => {
    if (!image) return;
    setProcessing(true);
    setError("");
    try {
      const source = await loadImage(image.url);
      const isPreset = activeTool === "crop";
      let outputWidth = isPreset ? selectedPreset.width : activeTool === "resize" ? resizeWidth : image.width;
      let outputHeight = isPreset ? selectedPreset.height : activeTool === "resize" ? resizeHeight : image.height;
      const maxPixels = 36_000_000;
      if (outputWidth * outputHeight > maxPixels) throw new Error("输出分辨率过大，请控制在 3600 万像素以内");

      const renderCanvas = (width: number, height: number) => {
        const nextCanvas = document.createElement("canvas");
        nextCanvas.width = width;
        nextCanvas.height = height;
        const context = nextCanvas.getContext("2d", { alpha: outputFormat !== "jpeg" });
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
        return nextCanvas;
      };

      let canvas = renderCanvas(outputWidth, outputHeight);
      const mime = `image/${outputFormat}`;
      let blob: Blob;

      if (activeTool === "compress" && sizeMode === "compress") {
        const target = Math.max(10, targetKB) * 1024;

        const encodeAtBestQuality = async (targetCanvas: HTMLCanvasElement) => {
          if (outputFormat === "png") return canvasToBlob(targetCanvas, mime);
          let low = 0.06;
          let high = Math.max(0.12, quality / 100);
          let smallest = await canvasToBlob(targetCanvas, mime, low);
          let bestUnderTarget: Blob | null = smallest.size <= target ? smallest : null;
          for (let i = 0; i < 10; i += 1) {
            const current = (low + high) / 2;
            const candidate = await canvasToBlob(targetCanvas, mime, current);
            if (candidate.size < smallest.size) smallest = candidate;
            if (candidate.size <= target) {
              if (!bestUnderTarget || candidate.size > bestUnderTarget.size) bestUnderTarget = candidate;
              low = current;
            } else {
              high = current;
            }
          }
          return bestUnderTarget ?? smallest;
        };

        blob = await encodeAtBestQuality(canvas);

        for (let attempt = 0; blob.size > target && attempt < 7; attempt += 1) {
          const minEdge = Math.min(outputWidth, outputHeight);
          if (minEdge <= 320) break;
          const scale = Math.max(0.55, Math.min(0.9, Math.sqrt(target / blob.size) * 0.95));
          const nextWidth = Math.max(1, Math.round(outputWidth * scale));
          const nextHeight = Math.max(1, Math.round(outputHeight * scale));
          if (nextWidth === outputWidth && nextHeight === outputHeight) break;
          outputWidth = nextWidth;
          outputHeight = nextHeight;
          canvas = renderCanvas(outputWidth, outputHeight);
          blob = await encodeAtBestQuality(canvas);
        }

        if (target >= image.file.size && image.file.type === mime && blob.size > image.file.size) {
          blob = image.file;
          outputWidth = image.width;
          outputHeight = image.height;
        }
      } else if (activeTool === "compress" && sizeMode === "enlarge") {
        const target = Math.max(10, targetKB) * 1024;
        if (target > 60 * 1024 * 1024) throw new Error("增容目标最大支持 60 MB");
        const baseBlob = await canvasToBlob(canvas, mime, quality / 100);
        if (target <= baseBlob.size) {
          throw new Error(`增容目标需大于当前导出体积 ${formatBytes(baseBlob.size)}`);
        }
        blob = await padImageBlob(baseBlob, outputFormat, target);
      } else {
        blob = await canvasToBlob(canvas, mime, quality / 100);
      }
      if (blob.type !== mime) throw new Error(`当前浏览器不支持导出 ${formatLabel[outputFormat]}，请选择其他格式`);
      if (result?.url) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob), width: outputWidth, height: outputHeight, format: outputFormat, sizeMode: activeTool === "compress" ? sizeMode : undefined });
      setStep("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "处理失败，请换一张图片重试");
    } finally {
      setProcessing(false);
    }
  };

  const processBatch = async () => {
    if (!batchItems.length) return;
    setProcessing(true);
    setError("");
    const mime = `image/${outputFormat}`;

    for (const item of batchItems) {
      setBatchItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "processing", error: undefined } : entry));
      try {
        const source = await loadImage(item.url);
        let outputWidth = activeTool === "resize" ? Math.max(1, Math.min(12000, resizeWidth)) : item.width;
        let outputHeight = activeTool === "resize" ? Math.max(1, Math.round(outputWidth * item.height / item.width)) : item.height;
        if (outputWidth * outputHeight > 36_000_000) throw new Error("输出超过 3600 万像素");

        const render = (width: number, height: number) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { alpha: outputFormat !== "jpeg" });
          if (!context) throw new Error("无法创建图片画布");
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          if (outputFormat === "jpeg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
          }
          context.drawImage(source, 0, 0, width, height);
          return canvas;
        };

        let canvas = render(outputWidth, outputHeight);
        let blob: Blob;
        if (activeTool === "compress") {
          const target = Math.max(10, targetKB) * 1024;
          const encode = async (targetCanvas: HTMLCanvasElement) => {
            if (outputFormat === "png") return canvasToBlob(targetCanvas, mime);
            let low = 0.06;
            let high = Math.max(0.12, quality / 100);
            let smallest = await canvasToBlob(targetCanvas, mime, low);
            let best: Blob | null = smallest.size <= target ? smallest : null;
            for (let attempt = 0; attempt < 10; attempt += 1) {
              const currentQuality = (low + high) / 2;
              const candidate = await canvasToBlob(targetCanvas, mime, currentQuality);
              if (candidate.size < smallest.size) smallest = candidate;
              if (candidate.size <= target) {
                if (!best || candidate.size > best.size) best = candidate;
                low = currentQuality;
              } else {
                high = currentQuality;
              }
            }
            return best ?? smallest;
          };
          blob = await encode(canvas);
          for (let attempt = 0; blob.size > target && attempt < 7; attempt += 1) {
            if (Math.min(outputWidth, outputHeight) <= 320) break;
            const scale = Math.max(0.55, Math.min(0.9, Math.sqrt(target / blob.size) * 0.95));
            outputWidth = Math.max(1, Math.round(outputWidth * scale));
            outputHeight = Math.max(1, Math.round(outputHeight * scale));
            canvas = render(outputWidth, outputHeight);
            blob = await encode(canvas);
          }
        } else {
          blob = await canvasToBlob(canvas, mime, quality / 100);
        }
        if (blob.type !== mime) throw new Error(`浏览器不支持导出 ${formatLabel[outputFormat]}`);
        setBatchItems((current) => current.map((entry) => entry.id === item.id ? {
          ...entry,
          status: "done",
          result: blob,
          resultWidth: outputWidth,
          resultHeight: outputHeight,
        } : entry));
      } catch (caught) {
        setBatchItems((current) => current.map((entry) => entry.id === item.id ? {
          ...entry,
          status: "error",
          error: caught instanceof Error ? caught.message : "处理失败",
        } : entry));
      }
    }
    setProcessing(false);
  };

  const downloadBatch = async () => {
    const completed = batchItems.filter((item) => item.status === "done" && item.result);
    if (!completed.length) return;
    setProcessing(true);
    setError("");
    try {
      const extension = outputFormat === "jpeg" ? "jpg" : outputFormat;
      const zip = await createZipBlob(completed.map((item, index) => ({
        name: `${String(index + 1).padStart(2, "0")}-${item.file.name.replace(/\.[^.]+$/, "") || "image"}.${extension}`,
        data: item.result!,
      })));
      const url = URL.createObjectURL(zip);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pixel-workshop-${completed.length}-images.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ZIP 生成失败");
    } finally {
      setProcessing(false);
    }
  };

  const removeBatchItem = (id: string) => {
    setBatchItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((item) => item.id !== id);
    });
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
    setError("");
  };

  const beginTool = (tool: Tool) => {
    setActiveTool(tool);
    if (image) setStep(tool === "crop" ? "templates" : "editor");
    else openPicker(tool);
  };

  const beginPreset = (preset: Preset) => {
    setSelectedPreset(preset);
    setActiveTool("crop");
    if (image) setStep("templates");
    else openPicker("crop");
  };

  const applyPreset = () => {
    setActiveTool("crop");
    processImage();
  };

  const savedPercent = image && result ? Math.max(0, Math.round((1 - result.blob.size / image.file.size) * 100)) : 0;
  const growthPercent = image && result ? Math.max(0, Math.round((result.blob.size / image.file.size - 1) * 100)) : 0;
  const batchDone = batchItems.filter((item) => item.status === "done").length;
  const batchFailed = batchItems.filter((item) => item.status === "error").length;

  return (
    <main className="site-shell">
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/*,.heic,.heif" multiple onChange={handleInput} />
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="返回首页">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /></span>
          <span>像素工坊</span>
        </button>
        <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}>
          {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
        </button>
      </header>

      {step === "home" && (
        <section className="home-view page-enter">
          <div className="hero-copy">
            <h1>轻松处理图片</h1>
            <p>选择图片，马上开始。</p>
          </div>

          <div className="upload-card" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
            <div className="image-stack" aria-hidden="true">
              <span className="mock-image back" />
              <span className="mock-image front" />
            </div>
            <h2>从一张图片开始</h2>
            <button className="primary-button" onClick={() => openPicker()}><ImageIcon size={18} />选择图片</button>
            <span className="upload-limit">JPG、PNG、WebP · 每张最大 30 MB · 最多 20 张</span>
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <section className="home-presets" aria-labelledby="common-presets-heading">
            <div className="home-section-heading"><h2 id="common-presets-heading">常用尺寸</h2><span>选择后载入图片</span></div>
            <div className="preset-shortcuts">
              {[presets[2], presets[1], presets[4]].map((preset) => (
                <button key={preset.id} onClick={() => beginPreset(preset)}>
                  <span className="shortcut-ratio" style={{ aspectRatio: `${preset.width}/${preset.height}` }} />
                  <span><strong>{preset.category === "微信" ? "公众号" : preset.category}</strong><small>{preset.ratio} · {preset.name.replace(preset.category, "").trim()}</small></span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>

          <div className="home-tool-strip" aria-label="图片工具">
            {tools.map(({ id, name, icon: Icon }) => <button key={id} onClick={() => beginTool(id)}><Icon size={16} />{name}</button>)}
          </div>

          <div className="home-privacy"><ShieldCheck size={15} /><span>图片不会上传，关闭页面后不留痕迹</span></div>
        </section>
      )}

      {step === "batch" && batchItems.length > 0 && (
        <section className="workspace batch-workspace page-enter">
          <div className="workspace-heading">
            <button className="back-button" onClick={reset}><ArrowLeft size={19} />返回</button>
            <div><h1>批量处理图片</h1><p>{batchItems.length} 张图片 · 统一设置，本地完成</p></div>
            <button className="subtle-button" onClick={() => openPicker()}><Images size={16} />重新选择</button>
          </div>

          <div className="batch-grid">
            <div className="batch-list-panel">
              <div className="batch-list-heading">
                <div><h2>图片队列</h2><p>{batchDone ? `已完成 ${batchDone}/${batchItems.length}` : "准备开始处理"}{batchFailed ? ` · ${batchFailed} 张失败` : ""}</p></div>
                <span>{batchItems.length}/20</span>
              </div>
              <div className="batch-list">
                {batchItems.map((item) => (
                  <div className="batch-item" key={item.id}>
                    <img src={item.url} alt="" />
                    <div className="batch-item-copy">
                      <strong>{item.file.name}</strong>
                      <span>{item.width}×{item.height} · {formatBytes(item.file.size)}</span>
                      {item.status === "done" && item.result && <em>{item.resultWidth}×{item.resultHeight} · {formatBytes(item.result.size)}</em>}
                      {item.status === "error" && <em className="batch-error">{item.error}</em>}
                    </div>
                    <span className={`batch-status ${item.status}`}>
                      {item.status === "ready" ? "待处理" : item.status === "processing" ? "处理中" : item.status === "done" ? "已完成" : "失败"}
                    </span>
                    <button className="batch-remove" onClick={() => removeBatchItem(item.id)} disabled={processing} aria-label={`移除 ${item.file.name}`}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="controls-panel batch-controls">
              <div className="tool-tabs batch-tabs" role="tablist">
                {tools.filter((tool) => tool.id !== "crop").map(({ id, name, icon: Icon }) => (
                  <button key={id} className={activeTool === id ? "active" : ""} onClick={() => setActiveTool(id)} role="tab"><Icon size={17} /><span>{name.replace("图片", "")}</span></button>
                ))}
              </div>
              <div className="control-body">
                <div className="control-section">
                  <div className="section-title"><div><h2>批量输出设置</h2><p>{activeTool === "compress" ? "每张尽量接近同一目标体积" : activeTool === "resize" ? "按统一宽度等比缩放" : "全部转换为同一种格式"}</p></div></div>
                  <div className="range-heading"><label>输出格式</label><span>{formatLabel[outputFormat]}</span></div>
                  <div className="compress-format-options">
                    {(["webp", "jpeg", "png"] as OutputFormat[]).map((format) => <button key={format} className={outputFormat === format ? "active" : ""} onClick={() => setOutputFormat(format)}>{formatLabel[format]}</button>)}
                  </div>
                  {activeTool === "compress" && <><label className="field-label">每张目标体积</label><div className="input-unit"><input type="number" min="10" max="60000" value={targetKB} onChange={(event) => setTargetKB(Number(event.target.value))} /><span>KB</span></div></>}
                  {activeTool === "resize" && <><label className="field-label">统一输出宽度</label><div className="input-unit"><input type="number" min="1" max="12000" value={resizeWidth} onChange={(event) => setResizeWidth(Number(event.target.value))} /><span>px</span></div><p className="helper info">每张图片独立保持原始宽高比，高度自动计算。</p></>}
                  {outputFormat !== "png" && <><div className="range-heading"><label htmlFor="batch-quality">{activeTool === "compress" ? "最高画质" : "输出画质"}</label><span>{quality}%</span></div><input id="batch-quality" className="range" type="range" min="10" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} style={{ "--value": `${quality}%` } as React.CSSProperties} /></>}
                  {activeTool === "compress" && <p className="helper">目标过小时会分别降低画质或分辨率，确保每张图片都真正变小。</p>}
                  <div className="batch-privacy"><ShieldCheck size={17} /><span>图片与 ZIP 都在当前设备生成，不会上传服务器。</span></div>
                  {error && <div className="error-banner compact" role="alert">{error}</div>}
                </div>
              </div>
              <div className="sticky-action batch-actions">
                <button className="primary-button" onClick={() => void processBatch()} disabled={processing}>{processing ? <><span className="spinner" />正在批量处理</> : <><WandSparkles size={18} />{batchDone ? "重新处理全部" : `开始处理 ${batchItems.length} 张`}</>}</button>
                {batchDone > 0 && <button className="secondary-button" onClick={() => void downloadBatch()} disabled={processing}><Archive size={18} />下载 ZIP（{batchDone} 张）</button>}
              </div>
            </div>
          </div>
        </section>
      )}

      {step === "editor" && image && (
        <section className="workspace editor-workspace page-enter">
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
                    <div className="section-title"><div><h2>文件体积</h2><p>{sizeMode === "compress" ? "尽量接近目标体积并保留画质" : "增加文件字节，不改变可见画面"}</p></div></div>
                    <div className="size-mode-toggle" role="group" aria-label="体积处理模式">
                      <button className={sizeMode === "compress" ? "active" : ""} onClick={() => selectSizeMode("compress")}><Minimize2 size={15} />压缩体积</button>
                      <button className={sizeMode === "enlarge" ? "active" : ""} onClick={() => selectSizeMode("enlarge")}><Maximize2 size={15} />增大体积</button>
                    </div>
                    <label className="field-label">目标体积</label>
                    <div className="input-unit"><input type="number" min="10" max="60000" value={targetKB} onChange={(event) => setTargetKB(Number(event.target.value))} /><span>KB</span><ChevronDown size={15} /></div>
                    <div className="range-heading"><label>文件格式</label><span>{outputFormat === "webp" ? "推荐" : outputFormat === "jpeg" ? "兼容性好" : "无损"}</span></div>
                    <div className="compress-format-options">
                      {(["webp", "jpeg", "png"] as OutputFormat[]).map((format) => (
                        <button key={format} className={outputFormat === format ? "active" : ""} onClick={() => setOutputFormat(format)}>{formatLabel[format]}</button>
                      ))}
                    </div>
                    <div className="range-heading"><label htmlFor="quality">{sizeMode === "compress" ? "画质" : "基础画质"}</label><span>{quality >= 90 ? "极佳" : quality >= 75 ? "推荐" : "较小"} · {quality}%</span></div>
                    <input id="quality" className="range" type="range" min="10" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} style={{ "--value": `${quality}%` } as React.CSSProperties} />
                    {sizeMode === "compress" ? <p className="helper">优先保持原始分辨率；最低画质仍超出目标时，会智能缩小像素尺寸以确保压缩有效。</p> : <p className="helper info">增容使用图片格式允许的注释或填充数据，不添加噪点、不改变分辨率，也不会凭空提升画质。</p>}
                    {sizeMode === "compress" && outputFormat === "png" && <p className="helper warning">PNG 不支持有损画质调节，达到较小目标体积时可能明显降低分辨率；照片建议选择 WebP 或 JPG。</p>}
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
              <div className="sticky-action"><button className="primary-button" onClick={processImage} disabled={processing}>{processing ? <><span className="spinner" />正在处理</> : <>{activeTool === "compress" ? sizeMode === "compress" ? "开始压缩" : "开始增大" : "开始处理"}<ArrowRight size={19} /></>}</button></div>
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
                {["抖音", "小红书", "微信", "通用", "电商", "证件照", "全部"].map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <p className="template-disclaimer">平台可能按展示位置二次裁剪，请将文字和主体放在中央安全区。</p>
              <div className="preset-list">
                {filteredPresets.map((preset) => (
                  <button className={`preset-card ${selectedPreset.id === preset.id ? "selected" : ""}`} key={preset.id} onClick={() => setSelectedPreset(preset)}>
                    <span className={`preset-thumb ${preset.tone}`}><ImageIcon size={22} /></span>
                    <span><strong>{preset.name}</strong><small>{preset.width} × {preset.height} · {preset.ratio}</small><em>{preset.note}</em></span>
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
                <div className={result.sizeMode === "enlarge" ? "growth" : "saving"}><small>{result.sizeMode === "enlarge" ? "体积增加" : "节省空间"}</small><strong>{result.sizeMode === "enlarge" ? `+${growthPercent}%` : `${savedPercent}%`}</strong></div>
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
