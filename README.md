# 像素工坊（Pixel Workshop）

移动端优先的在线图片处理工具。图片在浏览器本地完成转换、压缩、增容、尺寸调整和模板裁剪，无需上传服务器。

线上地址：[pixel-workshop.marcusyangty.chatgpt.site](https://pixel-workshop.marcusyangty.chatgpt.site)

## 当前功能

- JPG、PNG、WebP 相互转换；
- 按目标 KB 压缩，必要时自动降低分辨率；
- 使用合法图片格式块增大 JPG、PNG、WebP 文件体积；
- 自定义宽高、比例锁定和百分比缩放；
- 抖音、小红书、公众号、朋友圈、电商及证件照模板；
- 一次处理最多 20 张图片并下载 ZIP；
- 浅色/深色主题和移动端响应式界面；
- `/api/health` 生产健康检查。

## 隐私与限制

- 当前图片处理全部发生在用户浏览器内，服务器不会接收图片文件；
- 单张图片最大 30 MB，批量最多 20 张；
- 当前稳定输出格式为 JPG、PNG、WebP；
- HEIC、AVIF、GIF、TIFF、SVG、RAW、PSD、PDF 等格式仍在后续规划中；
- 社交媒体链接本地解析功能只完成调研，尚未进入开发。

## 本地开发

要求 Node.js `>=22.13.0`。

```bash
git clone https://github.com/TheYangTy/picture_tool.git
cd picture_tool
npm ci
npm run dev
```

常用命令：

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm test         # 生产构建 + 全部自动测试
npm run lint     # ESLint 检查
npm run start    # 启动已构建的生产服务
```

## 服务器部署

完整步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)，包含：

- Ubuntu + Node.js + systemd + Nginx；
- HTTPS/Certbot；
- Docker Compose；
- 健康检查、日志、更新、回滚与故障排查。

快速 Docker 启动：

```bash
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

容器端口只绑定到 `127.0.0.1:3000`，生产环境请通过 Nginx 或其他反向代理提供 HTTPS。

## 项目结构

```text
app/                  页面、图片处理核心和健康检查
tests/                产品、增容和 ZIP 自动测试
public/               图标与社交分享图片
deployment/nginx/     Nginx 配置模板
deployment/systemd/   systemd 服务模板
prototypes/           移动端原型图
PROJECT_ARCHITECTURE.md
SOCIAL_MEDIA_LOCAL_IMPORT_RESEARCH.md
DEVELOPMENT_LOG.md
DEPLOYMENT.md
```

## 文档

- [产品与技术架构](PROJECT_ARCHITECTURE.md)
- [完整开发过程](DEVELOPMENT_LOG.md)
- [社交媒体链接本地解析调研](SOCIAL_MEDIA_LOCAL_IMPORT_RESEARCH.md)
- [服务器部署指南](DEPLOYMENT.md)

## 技术栈

- React 19、Next.js 16、TypeScript；
- Vinext、Vite、Cloudflare Worker 兼容构建；
- Canvas 浏览器本地图片处理；
- 自研合法图片增容和 ZIP Store 编码模块。

## 许可证

当前仓库尚未声明开源许可证。除依赖项各自许可证允许的范围外，未经许可请勿复制、修改或再分发项目代码。正式开放社区贡献前应先确定许可证。
