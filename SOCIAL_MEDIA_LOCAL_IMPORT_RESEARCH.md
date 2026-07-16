# 社交媒体链接本地解析与下载：项目调研及方案

> 调研日期：2026-07-17  
> 目标平台：小红书、抖音、Instagram、X，后续可扩展 TikTok 及其他平台  
> 产品要求：媒体解析和下载在用户设备完成，不把链接、Cookie、图片或视频发送到本项目服务器

## 1. 结论

类似的开源项目确实存在，并且证明了“粘贴链接 → 解析全部媒体 → 选择下载”在技术上可行。但是，可靠项目都不是单纯依赖普通网页 JavaScript：它们会运行本地 Python/Node/Rust 程序、本地 HTTP API、Docker 容器、浏览器用户脚本或扩展。

原因是普通网页受到同源策略和 CORS 限制，不能直接读取其他平台的 HTML/API 响应，也不能读取平台 Cookie；部分平台还需要不断变化的签名参数、请求头、跳转处理和音视频合并。[MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

因此，本项目最适合采用：

**现有在线网站 + 用户本机 Companion（本地伴侣程序）**。

网站继续提供统一、移动端友好的产品界面；Companion 安装在用户电脑上，在 `127.0.0.1` 运行并完成解析、Cookie 读取、媒体请求、合并和下载。图片、视频和账号凭证不经过 Pixel Workshop 服务器。

## 2. 同类项目调研

### 2.1 cobalt

- 仓库：[imputnet/cobalt](https://github.com/imputnet/cobalt)
- 支持 Instagram Reels/图片/视频、多媒体选择；TikTok 视频和图集；Twitter/X 多媒体选择。
- API 能返回 `picker`，其中包含多张图片或视频，产品交互与本项目需求高度接近。
- 需要运行 cobalt API；官方文档明确没有可供其他项目直接使用的公共预托管 API，建议自行部署。
- `localProcessing` 只是把部分合并/转码工作放到客户端，解析和媒体隧道仍依赖 cobalt API，因此不是纯浏览器本地方案。
- 使用 Express、FFmpeg、Cookie 解析、限流和媒体 tunnel；许可证为 AGPL-3.0。

参考：[cobalt 支持平台](https://github.com/imputnet/cobalt/blob/main/api/README.md) · [cobalt API](https://github.com/imputnet/cobalt/blob/main/docs/api.md)

### 2.2 yt-dlp

- 仓库：[yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)
- 成熟的本地命令行引擎，支持大量站点，包含 Instagram、TikTok、Twitter/X 提取器。
- 能返回 JSON 元数据、多个格式和媒体 URL，适合做本地 Companion 的通用国外平台引擎。
- 支持 Cookie、代理、重试、格式选择和 FFmpeg 后处理。
- 官方也明确提示站点经常变化，列入支持清单不代表永久可用，真实能力必须运行检测并持续更新。
- 不应将它作为小红书和中国区抖音的唯一引擎。

参考：[yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md) · [支持站点说明](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

### 2.3 XHS-Downloader

- 仓库：[JoeanAmier/XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader)
- 支持小红书作品信息、图片、视频、Live Photo、分享短链、多个作品链接、指定图片序号和 ZIP。
- 提供本地可执行程序、Python 源码、Docker、命令行、MCP 和本地 API。
- 本地 API 默认运行于 `127.0.0.1:5556`，同时提供用户脚本连接本地程序；这一架构非常接近本项目推荐方案。
- Cookie 可选，但仓库说明未配置 Cookie 时视频可能只有低分辨率，高画质通常需要更新 Cookie。
- 分享链接规则变化会导致解析失效，项目 Issue 展示了平台改变短链格式后需要快速适配。
- 许可证为 GPL-3.0，不能在未完成许可证评估的情况下直接复制代码进入当前项目。

### 2.4 DouK-Downloader / TikTokDownloader

- 仓库：[JoeanAmier/TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader)
- 支持抖音/TikTok 视频、图集、实况、封面、原声、合集、批量链接及本地 Web API。
- 可执行程序和本地 API 的形态适合 Companion；API 默认运行于 `127.0.0.1:5555`。
- 需要 Cookie 才能获得更高分辨率或处理更多场景。
- 仓库当前明确说明部分加密参数算法已经失效且不再维护，因此不能直接把它当作唯一生产引擎。
- 许可证为 GPL-3.0，需要独立评估引用和分发方式。

### 2.5 TikTokDownload / F2

- 仓库：[Johnserf-Seed/TikTokDownload](https://github.com/Johnserf-Seed/TikTokDownload)
- 支持抖音/TikTok 视频、图集、封面、原声、长短链和异步下载。
- 支持从浏览器读取 Cookie，并在本地生成多个平台请求参数。
- 许可证为 MIT，比 GPL 项目更适合做代码层面的二次开发参考。
- 当前以 CLI/开发者接口为主，Web UI 和本地接口仍不完整，需要我们自行建设稳定 Adapter。

## 3. 三种本地方案比较

| 方案 | 是否真正本地 | 用户门槛 | 平台能力 | 移动端 | 结论 |
|---|---:|---:|---:|---:|---|
| 纯网页/PWA | 部分 | 最低 | 很弱，受 CORS/Cookie 限制 | 最好 | 不适合做四个平台的稳定解析 |
| 浏览器扩展/用户脚本 | 是 | 中 | 能使用页面上下文和登录状态 | 较差 | 适合作为增强入口，不适合唯一方案 |
| 本地 Companion 桌面程序 | 是 | 需要安装 | 最强，可运行 yt-dlp、FFmpeg 和平台 Adapter | 桌面优先 | 推荐主方案 |

浏览器扩展可以通过 Native Messaging 与本地应用通信，但需要扩展权限和本机 Host 注册。[Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)

Tauri 可以把 Python CLI 或本地 API 打包为 sidecar，让用户无需单独安装 Python/Node，并为 macOS、Windows 分别发布安装包。[Tauri Sidecar](https://v2.tauri.app/develop/sidecar/)

## 4. 推荐架构：Pixel Workshop Local Companion

```text
Pixel Workshop 在线界面
  ├─ 粘贴分享链接
  ├─ 检测本地 Companion
  ├─ 展示媒体卡片、全选与下载状态
  └─ 只向 127.0.0.1 发送任务，不接触 Cookie 和媒体
                   │
                   ▼
Pixel Workshop Local Companion
  ├─ Origin 白名单与一次性配对令牌
  ├─ URL 识别、短链展开、任务队列
  ├─ Instagram / X / TikTok Adapter → yt-dlp
  ├─ 小红书 Adapter → 独立实现，参考公开项目行为
  ├─ 抖音 Adapter → F2/MIT 方向或独立实现
  ├─ Cookie Vault → 仅存系统钥匙串或用户本机配置
  ├─ FFmpeg → 音视频合并、封装，不做画面水印擦除
  └─ 下载目录 / ZIP → 直接写入用户设备
```

### 4.1 网站与本地程序通信

- Companion 只监听 `127.0.0.1`，不监听局域网地址；
- 只允许正式站点 Origin，拒绝任意网页调用；
- 首次连接显示配对码，由用户在网页确认；
- 每个请求包含短期令牌、时间戳和 nonce，防止其他网页借用本地下载能力；
- `/health` 只返回版本和支持平台，不暴露 Cookie、目录和任务；
- `/resolve` 返回规范化媒体元数据；
- `/download` 由本地程序写文件并返回进度，不把媒体二进制传回网页；
- 新版浏览器可能对网站访问 loopback/本地网络增加权限提示，需要做能力检测和清晰引导。[MDN Local Network Access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access)

### 4.2 统一 Adapter 协议

```ts
type MediaResolver = {
  platform: "xiaohongshu" | "douyin" | "instagram" | "x" | "tiktok";
  canHandle(url: URL): boolean;
  resolve(input: ResolveInput): Promise<PostMediaResult>;
  download(item: MediaItem, destination: string): Promise<DownloadResult>;
  capabilities(): ResolverCapabilities;
};
```

每个平台 Adapter 独立版本、独立测试和独立更新，某个平台失效时不影响图片工具和其他下载平台。

## 5. 产品交互

1. 用户打开“链接提取”工具；
2. 网站检查本地 Companion；
3. 未安装时展示 macOS/Windows 安装按钮和隐私解释；
4. 用户粘贴分享文案或链接，自动提取其中 URL；
5. Companion 展开短链并识别平台；
6. 返回作者、标题、封面、全部图片/视频/Live Photo/音频列表；
7. 用户可以预览、单选、全选，选择原画或兼容版本；
8. 下载直接写入本地目录；多媒体帖子可选 ZIP；
9. 下载完成后可继续进入现有压缩、格式转换和封面裁剪功能。

## 6. “无水印”的产品定义

- 下载平台响应中可获得的原始或无平台叠加水印媒体；
- 不使用 AI、裁切、覆盖或像素修复擦除已嵌入画面的作者/平台水印；
- UI 使用“原始媒体”或“平台可用原画”描述，不承诺所有链接一定无水印；
- 私密、付费、已删除、受地区限制或需要额外权限的内容不绕过限制。

## 7. 许可证与维护策略

- cobalt、XHS-Downloader、DouK-Downloader 为 AGPL/GPL 路线，直接复制或组合发布前必须完成许可证评估；
- F2/TikTokDownload 的 MIT 许可证更适合参考或二次开发，但仍需保留版权与许可证文本；
- 优先复用稳定的可执行引擎和公开接口，不复制项目专属 UI；
- 所有 Adapter 必须有版本号、测试 URL fixture、失败分类和快速停用开关；
- 解析器需要独立自动更新，因为平台前端和签名参数会频繁变化。

## 8. 推荐实施顺序

### P0：本地通信原型

- 建立 Tauri 桌面壳和最小 sidecar；
- 网站检测 Companion、完成配对；
- 粘贴链接、返回演示媒体列表、下载本地测试文件；
- 验证 macOS HTTPS 网站到 loopback 通信、权限提示和安全边界。

### P1：Instagram、X、TikTok

- 集成 yt-dlp JSON 元数据输出；
- 多媒体帖子选择、质量选择、下载进度；
- Cookie 导入仅保存在本机。

### P2：小红书、抖音

- 建立独立 Adapter；
- 支持分享文案、短链、图文、视频、Live Photo；
- 加入 Cookie 状态、风控错误提示和解析器热更新；
- 对比 XHS-Downloader 和 F2 的真实样本，但不未经评估复制 GPL 代码。

### P3：浏览器扩展和移动端

- 浏览器扩展监听复制的链接并推送给 Companion；
- macOS/Windows 正式签名和自动更新；
- 移动端需另做原生 Share Extension，本地桌面 sidecar 不能直接覆盖手机浏览器。

## 9. 最终建议

不建议把解析代码直接塞进当前网页，也不建议为追求“零安装”转回远程抓取服务器。

建议保留现有 Pixel Workshop 网站，并新建同仓独立应用 `apps/local-companion`：

- Tauri：安装、系统权限、签名和更新；
- Rust 主进程：安全、本地任务与文件写入；
- 可替换 sidecar：yt-dlp、FFmpeg 和平台 Adapter；
- 现有 React UI：增加本地连接状态、分享链接输入和媒体选择页面。

这条路线能真正满足“本地处理”，同时保留现有网站入口和用户体验。
