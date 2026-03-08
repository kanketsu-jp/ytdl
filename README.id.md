# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 **Bahasa Indonesia**

CLI unduh media universal untuk pengembang. Mengunduh dari situs video via [yt-dlp](https://github.com/yt-dlp/yt-dlp), torrent (P2P), stream RTMP/RTSP, dan lainnya. UI interaktif + AI native (plugin Claude Code).

## Kepatuhan & Pemberitahuan Hukum

Proyek ini adalah alat unduh media umum.

Ditujukan untuk digunakan hanya pada konten yang:
- Anda memiliki haknya
- dilisensikan secara publik (misalnya Creative Commons)
- platform secara eksplisit mengizinkan pengunduhan

Pengguna bertanggung jawab untuk mematuhi undang-undang hak cipta dan ketentuan layanan setiap platform. Proyek ini **tidak** mendorong atau mendukung pengunduhan konten berhak cipta tanpa izin.

## Penggunaan Dilarang

- Mengunduh konten berhak cipta tanpa izin
- Mengunduh konten berbayar atau berlangganan tanpa otorisasi
- Mendistribusikan ulang media yang diunduh
- Mengelabui DRM atau langkah perlindungan teknis

## Penggunaan yang Diizinkan

- Backup konten yang Anda unggah sendiri
- Pemrosesan offline media yang Anda miliki haknya
- Mengarsipkan konten Creative Commons / domain publik
- Tujuan pendidikan dan penelitian dengan hak yang sesuai

## Instalasi

```bash
npm install -g @kanketsu/ytdl
```

Membutuhkan [yt-dlp](https://github.com/yt-dlp/yt-dlp) dan [ffmpeg](https://ffmpeg.org/). Pada eksekusi pertama, jika belum terinstal, ytdl akan menawarkan instalasi otomatis. Untuk instalasi manual:

```bash
brew install yt-dlp ffmpeg
```

### Bahasa

Bahasa UI default adalah Jepang. Untuk beralih ke Bahasa Indonesia:

```bash
# Variabel lingkungan
YTDL_LANG=id ytdl

# Flag CLI
ytdl --lang id "URL"
```

## Penggunaan

### Mode interaktif

Jalankan tanpa argumen — pilih langkah demi langkah:

```bash
ytdl
```

### Mode perintah

```bash
# Situs video (yt-dlp, 1000+ situs)
ytdl "https://example.com/watch?v=VIDEO_ID"        # kualitas terbaik + thumbnail + subtitle + deskripsi
ytdl -a "https://example.com/watch?v=VIDEO_ID"     # audio saja (m4a)
ytdl -q 720 "https://example.com/watch?v=VIDEO_ID" # 720p
ytdl -p "https://example.com/playlist?list=..."     # playlist
ytdl -i "https://example.com/watch?v=VIDEO_ID"     # info saja (tanpa unduh)

# Torrent / P2P
ytdl "magnet:?xt=urn:btih:..."                            # tautan magnet (auto-deteksi)
ytdl "https://example.com/file.torrent"                   # URL .torrent (auto-deteksi)
ytdl "./file.torrent"                                     # file .torrent lokal (auto-deteksi)

# Stream RTMP / RTSP
ytdl "rtmp://live.example.com/stream/key"                 # stream RTMP langsung
ytdl "rtsp://camera.example.com/feed"                     # kamera RTSP
ytdl --duration 60 "rtmp://..."                           # rekam 60 detik

# Penganalisis situs (ketika yt-dlp tidak dapat memperoleh media)
ytdl --analyze "https://example.com/page-with-video"      # paksa mode analisis situs

# Mode anonim (nama file berbasis tanggal, tanpa channel/judul)
ytdl --anon "https://example.com/watch?v=VIDEO_ID"

# Paksa backend tertentu
ytdl --via torrent "magnet:?xt=..."
ytdl --via stream "rtmp://..."
ytdl --via ytdlp "https://..."

# Teruskan opsi langsung ke yt-dlp
ytdl "URL" -- --limit-rate 1M
```

## Opsi

| Flag | Deskripsi | Default |
|------|-----------|---------|
| `-a` | Audio saja (m4a) | off |
| `-q <res>` | Kualitas (360/480/720/1080/1440/2160) | terbaik |
| `-o <dir>` | Direktori output | `~/Downloads` |
| `-p` | Mode playlist | off |
| `-b <browser>` | Browser cookie | off |
| `-n` | Tanpa cookie (default) | on |
| `-i` | Info saja | off |
| `-t` | Transkrip setelah unduh | off |
| `--backend <b>` | Backend transkripsi (local/api) | local |
| `--manuscript <path>` | Path file manuskrip (untuk akurasi) | - |
| `--lang <code>` | Bahasa (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--via <backend>` | Tentukan backend (ytdlp/torrent/stream/analyzer) | otomatis |
| `--analyze` | Paksa mode penganalisis situs | off |
| `--duration <detik>` | Durasi rekaman stream (detik) | sampai dihentikan |
| `--anon` | Mode anonim (nama file berbasis tanggal) | off |
| `--` | Teruskan ke yt-dlp | - |

Secara default, ytdl berjalan tanpa cookie browser. Gunakan `-b <browser>` untuk konten terbatas (batasan usia, khusus member, dll.).

## Arsitektur

ytdl secara otomatis mendeteksi backend yang tepat berdasarkan jenis URL:

```
ytdl CLI
  │
  ├── magnet: / .torrent  → Backend Torrent (webtorrent P2P)
  ├── rtmp:// / rtsp://   → Backend stream (ffmpeg spawn)
  ├── flag --analyze      → Backend penganalisis situs (Chrome CDP)
  └── http(s)://          → Backend yt-dlp (1000+ situs)
                               └── jika gagal → fallback penganalisis
```

Backend yt-dlp membungkus `bin/ytdl.sh` (tidak berubah sejak v1). Backend baru sepenuhnya ada di `lib/backends/`.

## Output

```
~/Downloads/
  └── Channel/
      └── Judul/
          ├── Judul.mp4
          ├── Judul.jpg           # thumbnail
          ├── Judul.id.srt        # subtitle
          ├── Judul.description.txt
          └── ytdl_20250226_1234.log
```

---

## Plugin Claude Code

Gunakan ytdl sebagai skill Claude Code. Claude akan bertanya secara interaktif apa yang ingin diunduh menggunakan AskUserQuestion. Mendukung situs video, tautan magnet, stream RTMP/RTSP, dan analisis situs.

### Instalasi

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### Penggunaan

Tempel URL media apa pun (situs video, tautan magnet, URL stream) atau katakan "unduh ini" di percakapan Claude Code mana pun. Skill aktif secara otomatis dan:

1. Memeriksa apakah `ytdl` terinstal (menawarkan instalasi jika belum)
2. Mendeteksi jenis URL dan memilih backend yang tepat
3. Mengambil info media (bila berlaku)
4. Menanyakan apa yang Anda inginkan (video/audio, kualitas, lokasi penyimpanan)
5. Mengunduh media

## Fitur AI

### Deteksi URL Universal

Cukup tempel URL apa pun — ytdl secara otomatis merutekan ke backend yang benar:
- Situs video (1000+ didukung) → yt-dlp
- tautan `magnet:` → Torrent (webtorrent)
- file `.torrent` (lokal atau URL) → Torrent (webtorrent)
- `rtmp://`, `rtsp://` → capture stream (ffmpeg)
- halaman dengan video tertanam → penganalisis situs

### Analisis URL Halaman

Anda tidak perlu mencari URL langsung video. Cukup tempel URL halaman tempat video tertanam, dan AI akan:

1. Menganalisis halaman untuk menemukan video yang tertanam
2. Menampilkan yang ditemukan (jika ada beberapa, memungkinkan Anda memilih)
3. Mengunduh video yang dipilih

Berfungsi dengan Claude Code.

**Contoh:**
```
Simpan video dari https://example.com/blog/my-post
```

### Unduhan Batch

Tempel beberapa URL sekaligus. AI menanyakan preferensi Anda (video/audio, kualitas) hanya sekali dan menerapkannya ke semua unduhan.

**Contoh:**
```
Unduh ini:
https://example.com/watch?v=aaa
https://example.com/watch?v=bbb
magnet:?xt=urn:btih:ccc
```

## Penafian

Perangkat lunak ini disediakan hanya untuk penggunaan yang sah. Penulis tidak bertanggung jawab atas penyalahgunaan apa pun.

## Lisensi

MIT
