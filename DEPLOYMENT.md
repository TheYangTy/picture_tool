# 像素工坊服务器部署指南

> 适用版本：当前 `main` 分支  
> 推荐系统：Ubuntu Server 22.04 LTS 或 24.04 LTS  
> 推荐方式：Node.js 生产进程 + systemd + Nginx + HTTPS  
> 备选方式：Docker Compose + Nginx

本文档从空白服务器开始，完整说明安装、构建、启动、域名、HTTPS、更新、回滚、监控和故障排查。命令中的域名、邮箱和路径请按实际情况替换。

## 1. 部署前说明

像素工坊当前的图片转换、压缩、增容、调整尺寸、模板裁剪和批量 ZIP 都在用户浏览器中执行。服务器只负责返回网页、JavaScript、CSS 和健康检查响应，因此：

- 不需要数据库、对象存储或图片上传目录；
- 用户图片不会保存在服务器；
- 服务器 CPU/内存压力主要来自网页请求，而不是图片处理；
- HTTPS 仍然必须配置，以保护页面代码和后续浏览器能力；
- `/api/health` 可用于负载均衡、容器和监控系统检查。

Vinext 的主要生产目标是 Cloudflare Workers，但当前项目不依赖数据库、图片服务端转换等 Worker 专属能力。`vinext start` 已在本项目中验证可启动生产构建并返回首页 200，适合普通 Linux 服务器部署。

## 2. 推荐服务器规格

小型公开站点建议：

| 项目 | 最低 | 推荐起步 |
|---|---:|---:|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 磁盘 | 10 GB | 20 GB SSD |
| 系统 | Ubuntu 22.04 | Ubuntu 24.04 LTS |
| Node.js | 22.13.0 | 最新 Node.js 22 LTS |

需要准备：

- 一台可以 SSH 登录的 Linux 服务器；
- 指向服务器公网 IP 的域名，例如 `picture.example.com`；
- GitHub 仓库读取权限；
- 服务器开放 TCP 80 和 443；
- 一个用于申请 HTTPS 证书的邮箱。

## 3. 方式一：Ubuntu + systemd + Nginx（推荐）

### 3.1 更新系统并安装基础软件

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ca-certificates nginx
```

安装 Node.js 22。下面使用 NodeSource；如果服务器已有受维护的 Node.js 22，可以跳过：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

确认 Node.js 不低于 `22.13.0`。

### 3.2 创建专用系统用户和目录

不要使用 root 运行网站。

```bash
sudo useradd --system \
  --home-dir /opt/pixel-workshop \
  --create-home \
  --shell /usr/sbin/nologin \
  pixelworkshop

sudo mkdir -p /opt/pixel-workshop/releases
sudo chown -R pixelworkshop:pixelworkshop /opt/pixel-workshop
```

### 3.3 下载源码

使用带时间戳的 release 目录，便于更新失败时快速回滚：

```bash
RELEASE="$(date +%Y%m%d%H%M%S)"
sudo -u pixelworkshop git clone --depth 1 \
  https://github.com/TheYangTy/picture_tool.git \
  "/opt/pixel-workshop/releases/$RELEASE"

cd "/opt/pixel-workshop/releases/$RELEASE"
```

如果仓库是私有仓库，推荐给服务器配置只读 Deploy Key，不要把个人访问令牌写入命令、脚本或 Git URL。

### 3.4 安装依赖并验证

```bash
sudo -u pixelworkshop npm ci
sudo -u pixelworkshop npm test
sudo -u pixelworkshop npm run lint
```

`npm test` 会执行生产构建和全部自动测试。只有测试通过后才继续。

创建当前版本软链接：

```bash
sudo ln -sfn "/opt/pixel-workshop/releases/$RELEASE" /opt/pixel-workshop/current
sudo chown -h pixelworkshop:pixelworkshop /opt/pixel-workshop/current
```

### 3.5 手动验证生产服务

先在前台启动一次：

```bash
cd /opt/pixel-workshop/current
sudo -u pixelworkshop npm run start -- --hostname 127.0.0.1 --port 3000
```

另开一个 SSH 终端执行：

```bash
curl -i http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/
```

健康检查应返回 HTTP 200 和类似内容：

```json
{"status":"ok","service":"pixel-workshop","timestamp":"..."}
```

验证完成后回到运行服务的终端按 `Ctrl+C` 停止。

### 3.6 配置 systemd

仓库已经提供服务模板：`deployment/systemd/pixel-workshop.service`。

```bash
sudo cp /opt/pixel-workshop/current/deployment/systemd/pixel-workshop.service \
  /etc/systemd/system/pixel-workshop.service

sudo systemctl daemon-reload
sudo systemctl enable --now pixel-workshop
sudo systemctl status pixel-workshop --no-pager
```

再次验证：

```bash
curl -i http://127.0.0.1:3000/api/health
```

常用管理命令：

```bash
sudo systemctl restart pixel-workshop
sudo systemctl stop pixel-workshop
sudo systemctl start pixel-workshop
sudo journalctl -u pixel-workshop -n 100 --no-pager
sudo journalctl -u pixel-workshop -f
```

服务只监听 `127.0.0.1:3000`，公网用户不能绕过 Nginx 直接访问 Node 端口。

### 3.7 配置 Nginx

复制模板：

```bash
sudo cp /opt/pixel-workshop/current/deployment/nginx/pixel-workshop.conf \
  /etc/nginx/sites-available/pixel-workshop.conf
```

修改域名：

```bash
sudo nano /etc/nginx/sites-available/pixel-workshop.conf
```

把：

```nginx
server_name picture.example.com;
```

改为真实域名。

启用站点并检查配置：

```bash
sudo ln -sfn /etc/nginx/sites-available/pixel-workshop.conf \
  /etc/nginx/sites-enabled/pixel-workshop.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

确认域名 DNS 已指向服务器后访问：

```bash
curl -I http://你的域名/
curl -i http://你的域名/api/health
```

### 3.8 配置 HTTPS

安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请并自动写入 Nginx 配置：

```bash
sudo certbot --nginx \
  -d 你的域名 \
  --redirect \
  --agree-tos \
  -m 你的邮箱
```

检查自动续期：

```bash
sudo systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run
```

最终验证：

```bash
curl -I https://你的域名/
curl -i https://你的域名/api/health
```

### 3.9 配置防火墙

如果使用 UFW：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

不要对公网开放 3000 端口。

## 4. 方式二：Docker Compose

### 4.1 安装 Docker

请优先使用 Docker 官方仓库安装 Docker Engine 和 Compose Plugin。安装完成后确认：

```bash
docker --version
docker compose version
```

### 4.2 下载并启动

```bash
git clone https://github.com/TheYangTy/picture_tool.git
cd picture_tool
docker compose up -d --build
docker compose ps
```

验证：

```bash
curl -i http://127.0.0.1:3000/api/health
docker inspect --format='{{.State.Health.Status}}' pixel-workshop
```

`docker-compose.yml` 默认：

- 只绑定 `127.0.0.1:3000`；
- 容器使用只读文件系统；
- 删除 Linux capabilities；
- 启用 `no-new-privileges`；
- 自动重启；
- 每 30 秒执行健康检查。

生产环境仍按前面的 Nginx 和 Certbot 步骤提供域名与 HTTPS。

### 4.3 Docker 常用命令

```bash
docker compose logs -f --tail=100
docker compose restart
docker compose stop
docker compose start
docker compose down
```

更新版本：

```bash
git fetch origin
git checkout main
git pull --ff-only
docker compose build --pull
docker compose up -d
docker image prune -f
```

## 5. 生产安全更新与回滚

### 5.1 systemd 方式更新

新版本先安装和测试，成功后再切换软链接：

```bash
RELEASE="$(date +%Y%m%d%H%M%S)"
sudo -u pixelworkshop git clone --depth 1 \
  https://github.com/TheYangTy/picture_tool.git \
  "/opt/pixel-workshop/releases/$RELEASE"

cd "/opt/pixel-workshop/releases/$RELEASE"
sudo -u pixelworkshop npm ci
sudo -u pixelworkshop npm test
sudo -u pixelworkshop npm run lint

PREVIOUS="$(readlink -f /opt/pixel-workshop/current)"
sudo ln -sfn "/opt/pixel-workshop/releases/$RELEASE" /opt/pixel-workshop/current
sudo systemctl restart pixel-workshop
curl --fail http://127.0.0.1:3000/api/health
```

健康检查失败时回滚：

```bash
sudo ln -sfn "$PREVIOUS" /opt/pixel-workshop/current
sudo systemctl restart pixel-workshop
curl --fail http://127.0.0.1:3000/api/health
```

确认新版稳定后，只保留最近 3～5 个 release 目录。删除旧版本前务必确认它不是 `current` 指向的目录。

### 5.2 Docker 方式回滚

推荐为镜像使用 Git commit 或版本号标签，而不是只保留 `latest`。如果当前采用本地构建，可先切回上一个 Git commit：

```bash
git log --oneline -10
git checkout 上一个稳定提交
docker compose up -d --build
curl --fail http://127.0.0.1:3000/api/health
```

确认后再决定是否让 Git 分支回到对应版本；不要在服务器上使用 `git reset --hard` 覆盖未确认的修改。

### 5.3 GitHub Actions 自动部署到腾讯云

仓库提供 `.github/workflows/deploy-tencent.yml`。合并到 `main` 后，每次推送会先执行构建、自动测试和 lint，全部通过后才部署到：

```text
https://yangtianyu.cloud/pictool/
```

工作流也支持在 GitHub Actions 页面通过 `workflow_dispatch` 手动触发。相同时间只允许一个 production 发布执行，后触发的任务会等待，避免两个版本同时切换。

#### 第一次配置服务器

在可信电脑生成一对只用于 GitHub Actions 的独立密钥。不要复用能够登录 root 的个人密钥：

```bash
ssh-keygen -t ed25519 \
  -C "github-actions-picture-tool" \
  -f ./picture-tool-actions \
  -N ""
```

把公钥和仓库中的两个部署脚本上传到服务器，然后以 root 执行一次 bootstrap：

```bash
scp ./picture-tool-actions.pub root@43.134.53.23:/tmp/
scp deployment/scripts/pixel-workshop-deploy \
  deployment/scripts/bootstrap-github-actions-deploy \
  root@43.134.53.23:/tmp/

ssh root@43.134.53.23
sudo mkdir -p /tmp/picture-tool-actions-bootstrap
sudo cp /tmp/pixel-workshop-deploy \
  /tmp/bootstrap-github-actions-deploy \
  /tmp/picture-tool-actions.pub \
  /tmp/picture-tool-actions-bootstrap/
sudo chmod 755 /tmp/picture-tool-actions-bootstrap/pixel-workshop-deploy \
  /tmp/picture-tool-actions-bootstrap/bootstrap-github-actions-deploy
sudo /tmp/picture-tool-actions-bootstrap/bootstrap-github-actions-deploy \
  /tmp/picture-tool-actions-bootstrap/picture-tool-actions.pub
```

bootstrap 会完成：

- 创建低权限 `pixeldeploy` 用户；
- 将公钥写入带 `restrict` 限制的 `authorized_keys`；
- 将 root 所有的发布程序安装到 `/usr/local/sbin/pixel-workshop-deploy`；
- 只允许 `pixeldeploy` 通过 sudo 调用该发布程序。

#### 配置 GitHub Secrets

在仓库 `Settings → Secrets and variables → Actions` 创建两个 Repository secret：

| Secret | 内容 |
|---|---|
| `TENCENT_DEPLOY_SSH_KEY` | `picture-tool-actions` 私钥的完整内容 |
| `TENCENT_SSH_KNOWN_HOSTS` | 已核对的服务器 SSH known_hosts 记录 |

known_hosts 可以在可信电脑生成：

```bash
ssh-keyscan -H 43.134.53.23 > ./tencent-known-hosts
ssh-keygen -lf ./tencent-known-hosts
```

设置 secret 前，应通过现有可信 SSH 会话或云控制台核对服务器主机密钥指纹，不能只信任网络扫描结果。使用已登录的 GitHub CLI 时可以执行：

```bash
gh secret set TENCENT_DEPLOY_SSH_KEY < ./picture-tool-actions
gh secret set TENCENT_SSH_KNOWN_HOSTS < ./tencent-known-hosts
```

设置完成后立即安全删除电脑上的部署私钥副本；GitHub 只会在 production deploy job 中读取它。

#### 自动发布与回滚行为

服务器发布程序只接受完整的 40 位 Git commit SHA。它会：

1. 获取 Actions 已验证的同一个提交；
2. 在 `.incoming-*` 临时目录安装依赖并执行 `/pictool/` 生产构建；
3. 构建成功后把目录变为正式 release；
4. 原子切换 `/opt/pixel-workshop/current`，安装对应 systemd unit 并重启；
5. 检查 `127.0.0.1:3000/api/health`；失败时自动恢复之前的 release。

工作流最后还会从公网检查健康接口、首页关键内容和 `/pictool/assets/` 资源前缀。服务器不会开放 3000 端口，用户图片仍然只在浏览器本地处理。

## 6. 监控与日志

### 6.1 健康检查

监控地址：

```text
https://你的域名/api/health
```

建议每 1 分钟检查一次：

- HTTP 状态必须为 200；
- JSON `status` 必须为 `ok`；
- 连续 3 次失败再告警，避免部署重启造成误报。

### 6.2 systemd 日志

```bash
sudo journalctl -u pixel-workshop --since '1 hour ago'
sudo journalctl -u pixel-workshop -f
```

限制 systemd 日志磁盘占用可修改 `/etc/systemd/journald.conf`，例如设置 `SystemMaxUse=500M`，然后重启 journald。

### 6.3 Nginx 日志

默认位置：

```text
/var/log/nginx/access.log
/var/log/nginx/error.log
```

建议安装并配置 logrotate；Ubuntu 的 Nginx 软件包默认已经包含轮转配置。

## 7. 数据、备份与隐私

当前版本没有用户数据库，也不接收或存储图片。因此不需要备份用户图片。

需要备份：

- `/etc/nginx/sites-available/pixel-workshop.conf`；
- `/etc/systemd/system/pixel-workshop.service`；
- 域名 DNS 记录；
- 自定义监控配置；
- 如果未来增加环境变量，只备份密钥管理系统中的配置，不要提交 `.env`。

Let's Encrypt 证书由 Certbot 自动管理，一般无需手动复制；做整机迁移时应重新申请或按 Certbot 官方方式迁移。

### 7.1 依赖安全审计

每次正式更新前运行：

```bash
npm audit --omit=dev
```

不要在生产服务器上直接执行 `npm audit fix --force`。该命令可能跨主版本替换框架依赖，应先在开发分支升级、完成构建和功能回归，再发布新 release。

本次文档整理时的审计结果为：生产依赖没有 high/critical，存在 2 个由 Next.js 间接依赖 PostCSS 带来的 moderate 提示；npm 当时只提供可能破坏版本兼容性的强制方案，因此没有自动修改。该快照会随依赖公告变化，部署时应以实时审计为准。

## 8. 故障排查

### 8.1 `npm ci` 失败

检查：

```bash
node --version
npm --version
df -h
free -h
```

确保 Node.js 不低于 22.13.0，磁盘和内存充足，并且服务器能访问 npm registry。

### 8.2 构建失败

```bash
npm ci
npm test
```

不要跳过失败测试直接上线。若失败与网络字体下载有关，检查服务器出站网络和 DNS。

### 8.3 systemd 服务启动失败

```bash
sudo systemctl status pixel-workshop --no-pager -l
sudo journalctl -u pixel-workshop -n 200 --no-pager
sudo -u pixelworkshop test -d /opt/pixel-workshop/current/dist
sudo -u pixelworkshop test -x /usr/bin/npm
```

常见原因：

- 没有运行 `npm test` 或 `npm run build`，因此缺少 `dist`；
- `/opt/pixel-workshop/current` 软链接错误；
- 文件不属于 `pixelworkshop` 用户；
- Node.js/npm 安装路径不是 `/usr/bin/npm`，需要修改 service 的 `ExecStart`。

### 8.4 Nginx 返回 502

```bash
curl -i http://127.0.0.1:3000/api/health
sudo systemctl status pixel-workshop --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

如果本地健康检查失败，先修复 Node 服务；如果本地成功而域名失败，检查 Nginx 的 `proxy_pass` 和防火墙。

### 8.5 页面打开但功能无效

图片功能运行在浏览器中，重点检查浏览器控制台、文件格式、文件大小和内存。服务器端通常不会出现图片转换日志。

尝试：

- 使用最新版 Chrome、Edge、Safari 或 Firefox；
- 用 JPG/PNG/WebP 小文件验证；
- 清除站点缓存后刷新；
- 检查反向代理是否返回了旧的 JavaScript 缓存；
- 确认页面和静态资源都使用 HTTPS。

## 9. 上线检查清单

- [ ] Node.js 版本不低于 22.13.0；
- [ ] `npm ci` 成功；
- [ ] `npm test` 全部通过；
- [ ] `npm run lint` 没有 error；
- [ ] `/api/health` 在本机返回 200；
- [ ] systemd 或 Docker 显示运行中；
- [ ] Node 端口只绑定 `127.0.0.1`；
- [ ] Nginx 配置测试通过；
- [ ] 域名 DNS 指向正确服务器；
- [ ] HTTPS 证书有效并开启 HTTP → HTTPS 跳转；
- [ ] 防火墙只开放 SSH、80、443；
- [ ] 手机和桌面浏览器均能打开；
- [ ] 单图转换、压缩、增容、尺寸、模板和批量 ZIP 完成一次真实测试；
- [ ] 健康监控和日志轮转已配置；
- [ ] 已记录当前稳定 Git commit，能够回滚。

## 10. 部署文件索引

| 文件 | 用途 |
|---|---|
| `Dockerfile` | 多阶段构建生产镜像 |
| `docker-compose.yml` | 本地回环端口、只读容器和健康检查 |
| `.dockerignore` | 减少构建上下文并避免复制本地文件 |
| `deployment/systemd/pixel-workshop.service` | Node 生产进程守护 |
| `deployment/nginx/pixel-workshop.conf` | 域名反向代理和安全响应头 |
| `app/api/health/route.ts` | 生产健康检查接口 |
| `.github/workflows/ci.yml` | GitHub push/PR 自动构建、测试和 lint |

部署过程中如果改变端口、安装路径或系统用户，请同步修改 systemd、Nginx、Docker 和监控配置，避免文档与真实运行环境不一致。
