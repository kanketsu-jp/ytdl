# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 **Bahasa Indonesia**

CLI unduh media berbasis [yt-dlp](https://github.com/yt-dlp/yt-dlp). UI interaktif + AI native (plugin Claude Code).

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
ytdl "https://www.youtube.com/watch?v=BaW_jenozKc"                 # kualitas terbaik + thumbnail + subtitle + deskripsi
ytdl -a "https://www.youtube.com/watch?v=BaW_jenozKc"              # audio saja (m4a)
ytdl -q 720 "https://www.youtube.com/watch?v=BaW_jenozKc"          # 720p
ytdl -p "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf" # playlist
ytdl -i "https://www.youtube.com/watch?v=BaW_jenozKc"              # info saja
ytdl -a -o ~/Music "https://www.youtube.com/watch?v=BaW_jenozKc"   # audio ke ~/Music
ytdl "URL" -- --limit-rate 1M                                       # opsi yt-dlp
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
| `--lang <code>` | Bahasa (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--` | Teruskan ke yt-dlp | - |

Secara default, ytdl berjalan tanpa cookie browser. Gunakan `-b <browser>` untuk konten terbatas (batasan usia, khusus member, dll.).

## Output

```
~/Downloads/
  └── Channel/
      └── Judul/
          ├── Judul.mp4
          ├── Judul.jpg           # thumbnail
          ├── Judul.id.srt        # subtitle
          └── Judul.description
```

---

## Plugin Claude Code

Gunakan ytdl sebagai skill Claude Code. Claude akan bertanya secara interaktif apa yang ingin diunduh menggunakan AskUserQuestion.

### Instalasi

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### Penggunaan

Tempel URL media atau katakan "unduh ini" di percakapan Claude Code mana pun. Skill aktif secara otomatis dan:

1. Memeriksa apakah `ytdl` terinstal (menawarkan instalasi jika belum)
2. Mengambil info media
3. Menanyakan apa yang Anda inginkan (video/audio, kualitas, lokasi penyimpanan)
4. Mengunduh media

## Fitur AI

### Analisis URL Halaman

Anda tidak perlu mencari URL langsung video. Cukup tempel URL halaman tempat video tertanam, dan AI akan:

1. Menganalisis halaman untuk menemukan video yang tertanam
2. Menampilkan yang ditemukan (jika ada beberapa, memungkinkan Anda memilih)
3. Mengunduh video yang dipilih

Berfungsi dengan Claude Code dan OpenClaw.

**Contoh:**
```
Simpan video dari https://example.com/blog/my-post
```

### Unduhan Batch

Tempel beberapa URL sekaligus. AI menanyakan preferensi Anda (video/audio, kualitas) hanya sekali dan menerapkannya ke semua unduhan.

**Contoh:**
```
Unduh ini:
https://youtube.com/watch?v=aaa
https://youtube.com/watch?v=bbb
https://youtube.com/watch?v=ccc
```

## Penafian

Perangkat lunak ini disediakan hanya untuk penggunaan yang sah. Penulis tidak bertanggung jawab atas penyalahgunaan apa pun.

## Lisensi

MIT
