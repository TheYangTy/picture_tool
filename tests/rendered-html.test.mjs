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
  assert.match(html, /选择图片或拖到这里/);
  assert.match(html, /格式转换/);
  assert.match(html, /压缩图片/);
  assert.match(html, /调整尺寸/);
  assert.match(html, /模板裁剪/);
  assert.match(html, /本地处理，保护隐私/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps production source and theme foundations in place", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /canvas\.toBlob/);
  assert.match(page, /type Step = "home" \| "editor" \| "templates" \| "result"/);
  assert.match(page, /localStorage\.setItem\("pixel-workshop-theme"/);
  assert.match(page, /targetKB/);
  assert.match(page, /padImageBlob/);
  assert.match(page, /增大体积/);
  assert.match(page, /体积增加/);
  assert.match(page, /encodeAtBestQuality/);
  assert.match(page, /Math\.sqrt\(target \/ blob\.size\)/);
  assert.match(page, /抖音主页封面/);
  assert.match(page, /小红书图文封面/);
  assert.match(page, /公众号首条封面/);
  assert.match(page, /公众号次条小图/);
  assert.match(page, /selectedPreset/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(packageJson, /"lucide-react"/);
  assert.match(packageJson, /node --test tests\/\*\.test\.mjs/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
