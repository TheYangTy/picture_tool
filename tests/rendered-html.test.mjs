import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Pixel Workshop product home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN"/i);
  assert.match(html, /<title>像素工坊｜免费图片转换、压缩与尺寸调整<\/title>/i);
  assert.match(html, /轻松处理图片/);
  assert.match(html, /选择图片，马上开始。/);
  assert.match(html, /从一张图片开始/);
  assert.match(html, /格式转换/);
  assert.match(html, /文件体积/);
  assert.match(html, /调整尺寸/);
  assert.match(html, /小红书/);
  assert.match(html, /抖音/);
  assert.match(html, /公众号/);
  assert.match(html, /图片不会上传，关闭页面后不留痕迹/);
  assert.doesNotMatch(html, /图片处理，<span>一步完成|免费、快速、无需上传/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("exposes a no-cache production health endpoint", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("health-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/health"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "pixel-workshop");
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("keeps production source and theme foundations in place", async () => {
  const [page, layout, css, packageJson, readme, deployment, dockerfile] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("DEPLOYMENT.md", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
  ]);

  assert.match(page, /canvas\.toBlob/);
  assert.match(page, /type Step = "home" \| "editor" \| "batch" \| "templates" \| "result"/);
  assert.match(page, /localStorage\.setItem\("pixel-workshop-theme"/);
  assert.match(page, /targetKB/);
  assert.match(page, /padImageBlob/);
  assert.match(page, /createZipBlob/);
  assert.match(page, /批量处理图片/);
  assert.match(page, /下载 ZIP/);
  assert.match(page, /multiple onChange/);
  assert.match(page, /增大体积/);
  assert.match(page, /体积增加/);
  assert.match(page, /encodeAtBestQuality/);
  assert.match(page, /Math\.sqrt\(target \/ blob\.size\)/);
  assert.match(page, /抖音主页封面/);
  assert.match(page, /小红书图文封面/);
  assert.match(page, /公众号首条封面/);
  assert.match(page, /公众号次条小图/);
  assert.match(page, /Instagram 竖版帖子/);
  assert.match(page, /X 主页横幅/);
  assert.match(page, /YouTube 视频缩略图/);
  assert.match(page, /正方形/);
  assert.match(page, /常用比例/);
  assert.match(page, /presetCategories/);
  assert.match(page, /filteredPresets\.length === 0/);
  assert.match(page, /\["compression", "templates"\]/);
  assert.match(page, /selectedPreset/);
  assert.match(page, /beginPreset/);
  assert.match(page, /className="image-stack"/);
  assert.match(page, /className="home-tool-strip"/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /prefers-reduced-transparency/);
  assert.match(css, /\.preset-shortcuts/);
  assert.match(css, /\.editor-workspace/);
  assert.match(css, /\.template-summary/);
  assert.match(css, /\.preset-empty/);
  assert.match(packageJson, /"lucide-react"/);
  assert.match(packageJson, /node --test tests\/\*\.test\.mjs/);
  assert.match(packageJson, /"name": "pixel-workshop"/);
  assert.match(readme, /像素工坊/);
  assert.match(readme, /DEPLOYMENT\.md/);
  assert.match(deployment, /systemd/);
  assert.match(deployment, /Docker Compose/);
  assert.match(deployment, /\/api\/health/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
