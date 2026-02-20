# ytdl

> 🇺🇸 English | 🇯🇵 日本語 | 🇨🇳 简体中文 | 🇪🇸 **Español** | 🇮🇳 हिन्दी | 🇧🇷 Português | 🇮🇩 Bahasa Indonesia

CLI de descarga de medios basado en [yt-dlp](https://github.com/yt-dlp/yt-dlp). UI interactiva + AI nativo (plugin de Claude Code).

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
ytdl "https://www.youtube.com/watch?v=BaW_jenozKc"                 # mejor calidad + miniatura + subtítulos + descripción
ytdl -a "https://www.youtube.com/watch?v=BaW_jenozKc"              # solo audio (m4a)
ytdl -q 720 "https://www.youtube.com/watch?v=BaW_jenozKc"          # 720p
ytdl -p "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf" # playlist
ytdl -i "https://www.youtube.com/watch?v=BaW_jenozKc"              # solo información
ytdl -a -o ~/Music "https://www.youtube.com/watch?v=BaW_jenozKc"   # audio en ~/Music
ytdl "URL" -- --limit-rate 1M                                       # opciones de yt-dlp
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
| `--lang <code>` | Idioma (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--` | Pasar a yt-dlp | - |

Por defecto, ytdl se ejecuta sin cookies del navegador. Use `-b <navegador>` para contenido restringido (edad, membresía, etc.).

## Salida

```
~/Downloads/
  └── Canal/
      └── Título/
          ├── Título.mp4
          ├── Título.jpg           # miniatura
          ├── Título.es.srt        # subtítulos
          └── Título.description
```

---

## Plugin de Claude Code

Use ytdl como habilidad de Claude Code. Claude preguntará interactivamente qué descargar usando AskUserQuestion.

### Instalación

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-jp-ytdl
```

### Uso

Pegue una URL de medios o diga "descarga esto" en cualquier conversación de Claude Code. La habilidad se activa automáticamente y:

1. Verifica si `ytdl` está instalado (propone instalar si falta)
2. Obtiene información del medio
3. Pregunta qué desea (video/audio, calidad, ubicación)
4. Descarga el medio

## Descargo de responsabilidad

Este software se proporciona solo para uso legal. Los autores no son responsables de ningún uso indebido.

## Licencia

MIT
