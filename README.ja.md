# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 **日本語** | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 [Bahasa Indonesia](./README.id.md)

[yt-dlp](https://github.com/yt-dlp/yt-dlp) ベースのメディア取得 CLI。インタラクティブ UI + AI ネイティブ（Claude Code プラグイン）。

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
ytdl "https://www.youtube.com/watch?v=BaW_jenozKc"                 # 最高画質＋サムネ＋字幕＋説明文
ytdl -a "https://www.youtube.com/watch?v=BaW_jenozKc"              # 音声のみ (m4a)
ytdl -q 720 "https://www.youtube.com/watch?v=BaW_jenozKc"          # 720p
ytdl -p "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf" # プレイリスト一括
ytdl -i "https://www.youtube.com/watch?v=BaW_jenozKc"              # 情報のみ
ytdl -a -o ~/Music "https://www.youtube.com/watch?v=BaW_jenozKc"   # 音声を~/Musicに
ytdl "URL" -- --limit-rate 1M                                       # yt-dlpオプション直渡し
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
| `--lang <code>` | 言語（`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`） | `ja` |
| `--` | 以降をyt-dlpに渡す | - |

デフォルトではブラウザのクッキーを使いません。制限付きコンテンツ（年齢制限、メンバー限定等）には `-b <ブラウザ>` を使用してください。

## 出力構造

```
~/Downloads/
  └── チャンネル名/
      └── タイトル/
          ├── タイトル.mp4
          ├── タイトル.jpg           # サムネイル
          ├── タイトル.ja.srt        # 字幕
          └── タイトル.description   # 説明文
```

---

## Claude Code プラグイン

ytdl を Claude Code のスキルとして使える。Claude が AskUserQuestion で対話的にダウンロード内容を確認してくれる。

### インストール

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### 使い方

Claude Code の会話でメディアの URL を貼るか「ダウンロードして」と言うだけ。スキルが自動で発動して:

1. `ytdl` がインストールされてなければインストールを提案
2. メディア情報を取得して表示
3. 何が欲しいか聞く（動画/音声、画質、保存先）
4. ダウンロード実行

## AI 機能

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
https://youtube.com/watch?v=aaa
https://youtube.com/watch?v=bbb
https://youtube.com/watch?v=ccc
```

## 免責事項

本ソフトウェアは合法的な使用のみを目的として提供されています。作者は一切の不正使用に対して責任を負いません。

## ライセンス

MIT
