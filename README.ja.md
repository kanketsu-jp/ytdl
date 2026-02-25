# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 **日本語** | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 [Bahasa Indonesia](./README.id.md)

開発者向けの汎用メディア取得 CLI。[yt-dlp](https://github.com/yt-dlp/yt-dlp)（動画サイト）、Torrent（P2P）、RTMP/RTSP ストリームなど多様なソースに対応。インタラクティブ UI + AI ネイティブ（Claude Code プラグイン）。

## コンプライアンス・法的事項

本プロジェクトは汎用的なメディア取得ツールです。

以下のコンテンツに対してのみ使用することを想定しています:
- 自身が権利を保有するコンテンツ
- パブリックライセンス（Creative Commons 等）のコンテンツ
- プラットフォームがダウンロードを明示的に許可しているコンテンツ

著作権法および各プラットフォームの利用規約の遵守はユーザーの責任です。本プロジェクトは許可なく著作物をダウンロードすることを推奨・支援する**ものではありません**。

## 禁止事項

- 許可のない著作物のダウンロード
- 有料・サブスクリプション限定コンテンツの無断ダウンロード
- ダウンロードしたメディアの再配布
- DRM や技術的保護手段の回避

## 許容される用途

- 自身がアップロードしたコンテンツのバックアップ
- 権利を持つメディアのオフライン処理
- Creative Commons / パブリックドメインコンテンツのアーカイブ
- 適切な権利を持つ教育・研究目的

## インストール

```bash
npm install -g @kanketsu/ytdl
```

[yt-dlp](https://github.com/yt-dlp/yt-dlp) と [ffmpeg](https://ffmpeg.org/) が必要です。初回実行時に未インストールであれば自動インストールを提案します。手動でインストールする場合:

```bash
brew install yt-dlp ffmpeg
```

### 言語設定

デフォルトは日本語です。英語に切り替える場合:

```bash
# 環境変数
YTDL_LANG=en ytdl

# CLI フラグ
ytdl --lang en "URL"
```

## 使い方

### インタラクティブモード

引数なしで実行 — ポチポチ選ぶだけ:

```bash
ytdl
```

### コマンドモード

```bash
# 動画サイト（yt-dlp、1000以上のサイト対応）
ytdl "https://example.com/watch?v=VIDEO_ID"        # 最高画質＋サムネ＋字幕＋説明文
ytdl -a "https://example.com/watch?v=VIDEO_ID"     # 音声のみ (m4a)
ytdl -q 720 "https://example.com/watch?v=VIDEO_ID" # 720p
ytdl -p "https://example.com/playlist?list=..."     # プレイリスト一括
ytdl -i "https://example.com/watch?v=VIDEO_ID"     # 情報のみ（ダウンロードしない）

# Torrent / P2P
ytdl "magnet:?xt=urn:btih:..."                            # マグネットリンク（自動検出）
ytdl "https://example.com/file.torrent"                   # .torrent URL（自動検出）

# RTMP / RTSP ストリーム
ytdl "rtmp://live.example.com/stream/key"                 # RTMP ライブ配信
ytdl "rtsp://camera.example.com/feed"                     # RTSP カメラ映像
ytdl --duration 60 "rtmp://..."                           # 60秒録画

# サイト解析（yt-dlp で取得できない場合）
ytdl --analyze "https://example.com/page-with-video"      # サイト解析モードを強制

# バックエンドを強制指定
ytdl --via torrent "magnet:?xt=..."
ytdl --via stream "rtmp://..."
ytdl --via ytdlp "https://..."

# yt-dlp オプション直渡し
ytdl "URL" -- --limit-rate 1M
```

## オプション

| フラグ | 説明 | デフォルト |
|------|------|---------|
| `-a` | 音声のみ（m4a） | off |
| `-q <解像度>` | 画質指定（360/480/720/1080/1440/2160） | 最高画質 |
| `-o <ディレクトリ>` | 保存先 | `~/Downloads` |
| `-p` | プレイリストモード | off |
| `-b <ブラウザ>` | クッキー取得元 | off |
| `-n` | クッキーなし（デフォルト） | on |
| `-i` | 情報のみ | off |
| `-t` | ダウンロード後に文字起こし | off |
| `--backend <b>` | 文字起こしバックエンド (local/api) | local |
| `--manuscript <path>` | 原稿ファイルパス（精度向上用） | - |
| `--lang <code>` | 言語（`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`） | `ja` |
| `--via <backend>` | バックエンド指定（ytdlp/torrent/stream/analyzer） | 自動 |
| `--analyze` | サイト解析モードを強制 | off |
| `--duration <秒>` | ストリーム録画時間（秒） | 停止まで |
| `--` | 以降をyt-dlpに渡す | - |

デフォルトではブラウザのクッキーを使いません。制限付きコンテンツ（年齢制限、メンバー限定等）には `-b <ブラウザ>` を使用してください。

## アーキテクチャ

ytdl は URL の種別から自動でバックエンドを選択します:

```
ytdl CLI
  │
  ├── magnet: / .torrent  → Torrent バックエンド（webtorrent P2P）
  ├── rtmp:// / rtsp://   → ストリームバックエンド（ffmpeg spawn）
  ├── --analyze フラグ    → サイト解析バックエンド（Chrome CDP）
  └── http(s)://          → yt-dlp バックエンド（1000以上のサイト）
                               └── 失敗時 → サイト解析にフォールバック
```

yt-dlp バックエンドは `bin/ytdl.sh`（v1 から変更なし）をラップします。新バックエンドは `lib/backends/` に実装されています。

## 出力構造

```
~/Downloads/
  └── チャンネル名/
      └── タイトル/
          ├── タイトル.mp4
          ├── タイトル.jpg           # サムネイル
          ├── タイトル.ja.srt        # 字幕
          ├── タイトル.description.txt   # 説明文
          └── ytdl_20250226_1234.log     # ログ
```

---

## Claude Code プラグイン

ytdl を Claude Code のスキルとして使える。Claude が AskUserQuestion で対話的にダウンロード内容を確認してくれます。動画サイト、マグネットリンク、RTMP/RTSP ストリーム、サイト解析に対応。

### インストール

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### 使い方

Claude Code の会話でメディアの URL を貼るか「ダウンロードして」と言うだけ。スキルが自動で発動して:

1. `ytdl` がインストールされてなければインストールを提案
2. URL の種別を判定して適切なバックエンドを選択
3. メディア情報を取得して表示（可能な場合）
4. 何が欲しいか聞く（動画/音声、画質、保存先）
5. ダウンロード実行

## AI 機能

### 汎用URL検出

URLをそのまま貼るだけで、ytdl が自動的に適切なバックエンドにルーティングします:
- 動画サイト（1000以上対応） → yt-dlp
- `magnet:` リンク → Torrent（webtorrent）
- `rtmp://`、`rtsp://` → ストリームキャプチャ（ffmpeg）
- 動画が埋め込まれたページ → サイト解析

### ページURL解析

動画の直接URLを探す必要はありません。動画が埋め込まれたページのURLを貼るだけで、AIが:

1. ページを解析して埋め込み動画を検出
2. 見つかった動画を表示（複数あれば選択可能）
3. 選択した動画をダウンロード

Claude Code で利用可能。

**例:**
```
https://example.com/blog/my-post の動画を保存して
```

### 一括ダウンロード

複数のURLをまとめて貼るだけ。動画/音声、画質などの設定は1回だけ聞かれ、全URLに適用されます。

**例:**
```
これらをダウンロードして:
https://example.com/watch?v=aaa
https://example.com/watch?v=bbb
magnet:?xt=urn:btih:ccc
```

## 免責事項

本ソフトウェアは合法的な使用のみを目的として提供されています。作者は一切の不正使用に対して責任を負いません。

## ライセンス

MIT
