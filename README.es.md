# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 **Español** | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 [Bahasa Indonesia](./README.id.md)

CLI universal de descarga de medios orientada a desarrolladores. Descarga desde sitios de video vía [yt-dlp](https://github.com/yt-dlp/yt-dlp), torrents (P2P), streams RTMP/RTSP y más. UI interactiva + AI nativo (plugin de Claude Code).

## Cumplimiento y aviso legal

Este proyecto es una herramienta general de descarga de medios.

Está diseñado para usarse solo con contenido que:
- usted posee los derechos
- tiene licencia pública (ej. Creative Commons)
- la plataforma permite explícitamente su descarga

Los usuarios son responsables de cumplir con las leyes de derechos de autor y los términos de servicio de cada plataforma. Este proyecto **no** fomenta ni apoya la descarga de contenido protegido sin permiso.

## Uso prohibido

- Descargar contenido protegido sin permiso
- Descargar contenido de pago o por suscripción sin autorización
- Redistribuir medios descargados
- Eludir DRM o medidas de protección técnica

## Casos de uso permitidos

- Respaldar contenido que usted subió
- Procesamiento offline de medios sobre los que tiene derechos
- Archivar contenido Creative Commons / dominio público
- Fines educativos y de investigación con derechos apropiados

## Instalación

```bash
npm install -g @kanketsu/ytdl
```

Requiere [yt-dlp](https://github.com/yt-dlp/yt-dlp) y [ffmpeg](https://ffmpeg.org/). En la primera ejecución, ytdl ofrecerá instalarlos automáticamente si faltan. Para instalar manualmente:

```bash
brew install yt-dlp ffmpeg
```

### Idioma

El idioma predeterminado de la UI es japonés. Para cambiar a español:

```bash
# Variable de entorno
YTDL_LANG=es ytdl

# Parámetro CLI
ytdl --lang es "URL"
```

## Uso

### Modo interactivo

Ejecutar sin argumentos — seleccione paso a paso:

```bash
ytdl
```

### Modo comando

```bash
# Sitios de video (yt-dlp, más de 1000 sitios)
ytdl "https://example.com/watch?v=VIDEO_ID"        # mejor calidad + miniatura + subtítulos + descripción
ytdl -a "https://example.com/watch?v=VIDEO_ID"     # solo audio (m4a)
ytdl -q 720 "https://example.com/watch?v=VIDEO_ID" # 720p
ytdl -p "https://example.com/playlist?list=..."     # playlist
ytdl -i "https://example.com/watch?v=VIDEO_ID"     # solo información (sin descarga)

# Torrent / P2P
ytdl "magnet:?xt=urn:btih:..."                            # enlace magnet (auto-detectado)
ytdl "https://example.com/file.torrent"                   # URL .torrent (auto-detectado)

# Streams RTMP / RTSP
ytdl "rtmp://live.example.com/stream/key"                 # stream RTMP en vivo
ytdl "rtsp://camera.example.com/feed"                     # cámara RTSP
ytdl --duration 60 "rtmp://..."                           # grabar 60 segundos

# Analizador de sitios (cuando yt-dlp no puede obtener el medio)
ytdl --analyze "https://example.com/page-with-video"      # forzar análisis de sitio

# Forzar un backend específico
ytdl --via torrent "magnet:?xt=..."
ytdl --via stream "rtmp://..."
ytdl --via ytdlp "https://..."

# Pasar opciones directamente a yt-dlp
ytdl "URL" -- --limit-rate 1M
```

## Opciones

| Flag | Descripción | Predeterminado |
|------|-------------|----------------|
| `-a` | Solo audio (m4a) | off |
| `-q <res>` | Calidad (360/480/720/1080/1440/2160) | mejor |
| `-o <dir>` | Directorio de salida | `~/Downloads` |
| `-p` | Modo playlist | off |
| `-b <navegador>` | Navegador para cookies | off |
| `-n` | Sin cookies (predeterminado) | on |
| `-i` | Solo información | off |
| `-t` | Transcribir después de descargar | off |
| `--backend <b>` | Backend de transcripción (local/api) | local |
| `--manuscript <path>` | Ruta del manuscrito (para precisión) | - |
| `--lang <code>` | Idioma (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--via <backend>` | Especificar backend (ytdlp/torrent/stream/analyzer) | auto |
| `--analyze` | Forzar modo analizador de sitios | off |
| `--duration <seg>` | Duración de grabación de stream (segundos) | hasta detener |
| `--` | Pasar a yt-dlp | - |

Por defecto, ytdl se ejecuta sin cookies del navegador. Use `-b <navegador>` para contenido restringido (edad, membresía, etc.).

## Arquitectura

ytdl detecta automáticamente el backend correcto según el tipo de URL:

```
ytdl CLI
  │
  ├── magnet: / .torrent  → Backend Torrent (webtorrent P2P)
  ├── rtmp:// / rtsp://   → Backend stream (ffmpeg spawn)
  ├── flag --analyze      → Backend analizador de sitios (Chrome CDP)
  └── http(s)://          → Backend yt-dlp (1000+ sitios)
                               └── en fallo → fallback analizador
```

El backend yt-dlp envuelve `bin/ytdl.sh` (sin cambios desde v1). Los nuevos backends están completamente en `lib/backends/`.

## Salida

```
~/Downloads/
  └── Canal/
      └── Título/
          ├── Título.mp4
          ├── Título.jpg           # miniatura
          ├── Título.es.srt        # subtítulos
          ├── Título.description.txt
          └── ytdl_20250226_1234.log
```

---

## Plugin de Claude Code

Use ytdl como habilidad de Claude Code. Claude preguntará interactivamente qué descargar usando AskUserQuestion. Compatible con sitios de video, enlaces magnet, streams RTMP/RTSP y análisis de sitios.

### Instalación

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### Uso

Pegue cualquier URL de medios (sitio de video, enlace magnet, URL de stream) o diga "descarga esto" en cualquier conversación de Claude Code. La habilidad se activa automáticamente y:

1. Verifica si `ytdl` está instalado (propone instalar si falta)
2. Detecta el tipo de URL y selecciona el backend apropiado
3. Obtiene información del medio (cuando aplica)
4. Pregunta qué desea (video/audio, calidad, ubicación)
5. Descarga el medio

## Funciones IA

### Detección universal de URL

Solo pegue cualquier URL — ytdl enruta automáticamente al backend correcto:
- Sitios de video (1000+ compatibles) → yt-dlp
- enlaces `magnet:` → Torrent (webtorrent)
- `rtmp://`, `rtsp://` → captura de stream (ffmpeg)
- página con video incrustado → analizador de sitios

### Análisis de URL de página

No necesita buscar la URL directa del video. Solo pegue la URL de la página donde está el video y la IA:

1. Analiza la página para encontrar videos incrustados
2. Muestra lo encontrado (si hay varios, le permite elegir)
3. Descarga el/los video(s) seleccionado(s)

Funciona con Claude Code.

**Ejemplo:**
```
Guarda el video de https://example.com/blog/my-post
```

### Descargas en lote

Pegue múltiples URLs a la vez. La IA pregunta sus preferencias (video/audio, calidad) solo una vez y las aplica a todas las descargas.

**Ejemplo:**
```
Descarga estos:
https://example.com/watch?v=aaa
https://example.com/watch?v=bbb
magnet:?xt=urn:btih:ccc
```

## Descargo de responsabilidad

Este software se proporciona solo para uso legal. Los autores no son responsables de ningún uso indebido.

## Licencia

MIT
