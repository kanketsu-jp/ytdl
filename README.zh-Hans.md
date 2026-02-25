# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 **简体中文** | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 [Bahasa Indonesia](./README.id.md)

面向开发者的通用媒体获取 CLI。支持通过 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 下载视频网站内容、Torrent（P2P）、RTMP/RTSP 流媒体等多种来源。交互式 UI + AI 原生（Claude Code 插件）。

## 合规与法律声明

本项目是通用媒体获取工具。

仅适用于以下内容：
- 您拥有版权的内容
- 公共许可（如 Creative Commons）内容
- 平台明确允许下载的内容

用户有责任遵守版权法和各平台的服务条款。本项目**不**鼓励或支持未经许可下载受版权保护的内容。

## 禁止用途

- 未经许可下载受版权保护的内容
- 未经授权下载付费或订阅内容
- 再分发下载的媒体
- 规避 DRM 或技术保护措施

## 允许用途

- 备份您自己上传的内容
- 离线处理您拥有权利的媒体
- 归档 Creative Commons / 公共领域内容
- 拥有适当权利的教育和研究目的

## 安装

```bash
npm install -g @kanketsu/ytdl
```

需要 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 和 [ffmpeg](https://ffmpeg.org/)。首次运行时，如果未安装，ytdl 会提供自动安装。手动安装：

```bash
brew install yt-dlp ffmpeg
```

### 语言设置

默认 UI 语言为日语。切换为中文：

```bash
# 环境变量
YTDL_LANG=zh-Hans ytdl

# CLI 参数
ytdl --lang zh-Hans "URL"
```

## 使用方法

### 交互模式

不带参数运行 — 逐步选择：

```bash
ytdl
```

### 命令模式

```bash
# 视频网站（yt-dlp，支持 1000+ 网站）
ytdl "https://example.com/watch?v=VIDEO_ID"        # 最高画质 + 缩略图 + 字幕 + 描述
ytdl -a "https://example.com/watch?v=VIDEO_ID"     # 仅音频 (m4a)
ytdl -q 720 "https://example.com/watch?v=VIDEO_ID" # 720p
ytdl -p "https://example.com/playlist?list=..."     # 播放列表
ytdl -i "https://example.com/watch?v=VIDEO_ID"     # 仅信息（不下载）

# Torrent / P2P
ytdl "magnet:?xt=urn:btih:..."                            # 磁力链接（自动检测）
ytdl "https://example.com/file.torrent"                   # .torrent URL（自动检测）

# RTMP / RTSP 流媒体
ytdl "rtmp://live.example.com/stream/key"                 # RTMP 直播
ytdl "rtsp://camera.example.com/feed"                     # RTSP 摄像头
ytdl --duration 60 "rtmp://..."                           # 录制 60 秒

# 网站分析（当 yt-dlp 无法获取时）
ytdl --analyze "https://example.com/page-with-video"      # 强制网站分析模式

# 强制指定后端
ytdl --via torrent "magnet:?xt=..."
ytdl --via stream "rtmp://..."
ytdl --via ytdlp "https://..."

# 直接传递 yt-dlp 选项
ytdl "URL" -- --limit-rate 1M
```

## 选项

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-a` | 仅音频（m4a） | off |
| `-q <分辨率>` | 画质（360/480/720/1080/1440/2160） | 最高 |
| `-o <目录>` | 输出目录 | `~/Downloads` |
| `-p` | 播放列表模式 | off |
| `-b <浏览器>` | Cookie 浏览器 | off |
| `-n` | 不使用 Cookie（默认） | on |
| `-i` | 仅信息 | off |
| `-t` | 下载后转录 | off |
| `--backend <b>` | 转录后端 (local/api) | local |
| `--manuscript <path>` | 原稿文件路径（提高准确度） | - |
| `--lang <code>` | 语言（`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`） | `ja` |
| `--via <backend>` | 指定后端（ytdlp/torrent/stream/analyzer） | 自动 |
| `--analyze` | 强制网站分析模式 | off |
| `--duration <秒>` | 流媒体录制时长（秒） | 直到停止 |
| `--` | 传递给 yt-dlp | - |

默认不使用浏览器 Cookie。对于受限内容（年龄限制、会员专属等），请使用 `-b <浏览器>`。

## 架构

ytdl 根据 URL 类型自动选择合适的后端：

```
ytdl CLI
  │
  ├── magnet: / .torrent  → Torrent 后端（webtorrent P2P）
  ├── rtmp:// / rtsp://   → 流媒体后端（ffmpeg spawn）
  ├── --analyze 标志      → 网站分析后端（Chrome CDP）
  └── http(s)://          → yt-dlp 后端（1000+ 网站）
                               └── 失败时 → 网站分析兜底
```

yt-dlp 后端封装 `bin/ytdl.sh`（与 v1 相同）。新后端完全在 `lib/backends/` 中实现。

## 输出结构

```
~/Downloads/
  └── 频道名/
      └── 标题/
          ├── 标题.mp4
          ├── 标题.jpg           # 缩略图
          ├── 标题.zh-Hans.srt   # 字幕
          ├── 标题.description.txt   # 描述
          └── ytdl_20250226_1234.log # 日志
```

---

## Claude Code 插件

将 ytdl 作为 Claude Code 技能使用。Claude 会通过 AskUserQuestion 交互式确认下载内容。支持视频网站、磁力链接、RTMP/RTSP 流媒体和网站分析。

### 安装

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### 使用方法

在 Claude Code 对话中粘贴任意媒体 URL 或说"下载这个"。技能会自动激活：

1. 检查 `ytdl` 是否已安装（未安装则提示安装）
2. 检测 URL 类型并选择合适的后端
3. 获取媒体信息（如适用）
4. 询问您的需求（视频/音频、画质、保存位置）
5. 执行下载

## AI 功能

### 通用 URL 检测

直接粘贴任意 URL，ytdl 会自动路由到正确的后端：
- 视频网站（支持 1000+ 站点） → yt-dlp
- `magnet:` 链接 → Torrent（webtorrent）
- `rtmp://`、`rtsp://` → 流媒体抓取（ffmpeg）
- 包含嵌入视频的页面 → 网站分析

### 页面URL分析

无需自己查找视频的直接URL。只需粘贴包含视频的网页URL，AI 会：

1. 分析页面以查找嵌入的视频
2. 展示找到的视频（如有多个，可供选择）
3. 下载选定的视频

适用于 Claude Code。

**示例：**
```
保存 https://example.com/blog/my-post 中的视频
```

### 批量下载

一次粘贴多个URL。AI 只问一次偏好设置（视频/音频、画质），然后应用到所有下载。

**示例：**
```
下载这些：
https://example.com/watch?v=aaa
https://example.com/watch?v=bbb
magnet:?xt=urn:btih:ccc
```

## 免责声明

本软件仅供合法使用。作者不对任何滥用行为负责。

## 许可证

MIT
