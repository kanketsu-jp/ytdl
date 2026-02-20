# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 **Português** | 🇮🇩 [Bahasa Indonesia](./README.id.md)

CLI de download de mídia baseado em [yt-dlp](https://github.com/yt-dlp/yt-dlp). UI interativa + AI nativo (plugin Claude Code).

## Conformidade e aviso legal

Este projeto é uma ferramenta geral de download de mídia.

Destina-se ao uso apenas com conteúdo que:
- você possui os direitos
- possui licença pública (ex: Creative Commons)
- a plataforma permite explicitamente o download

Os usuários são responsáveis por cumprir as leis de direitos autorais e os termos de serviço de cada plataforma. Este projeto **não** incentiva ou apoia o download de conteúdo protegido sem permissão.

## Uso proibido

- Download de conteúdo protegido sem permissão
- Download de conteúdo pago ou por assinatura sem autorização
- Redistribuição de mídia baixada
- Contornar DRM ou medidas de proteção técnica

## Casos de uso permitidos

- Backup do conteúdo que você enviou
- Processamento offline de mídia sobre a qual você tem direitos
- Arquivamento de conteúdo Creative Commons / domínio público
- Fins educacionais e de pesquisa com direitos adequados

## Instalação

```bash
npm install -g @kanketsu/ytdl
```

Requer [yt-dlp](https://github.com/yt-dlp/yt-dlp) e [ffmpeg](https://ffmpeg.org/). Na primeira execução, se não estiverem instalados, o ytdl oferecerá instalação automática. Para instalar manualmente:

```bash
brew install yt-dlp ffmpeg
```

### Idioma

O idioma padrão da UI é japonês. Para mudar para português:

```bash
# Variável de ambiente
YTDL_LANG=pt ytdl

# Flag CLI
ytdl --lang pt "URL"
```

## Uso

### Modo interativo

Execute sem argumentos — selecione passo a passo:

```bash
ytdl
```

### Modo comando

```bash
ytdl "https://www.youtube.com/watch?v=BaW_jenozKc"                 # melhor qualidade + miniatura + legendas + descrição
ytdl -a "https://www.youtube.com/watch?v=BaW_jenozKc"              # somente áudio (m4a)
ytdl -q 720 "https://www.youtube.com/watch?v=BaW_jenozKc"          # 720p
ytdl -p "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf" # playlist
ytdl -i "https://www.youtube.com/watch?v=BaW_jenozKc"              # apenas informações
ytdl -a -o ~/Music "https://www.youtube.com/watch?v=BaW_jenozKc"   # áudio em ~/Music
ytdl "URL" -- --limit-rate 1M                                       # opções do yt-dlp
```

## Opções

| Flag | Descrição | Padrão |
|------|-----------|--------|
| `-a` | Somente áudio (m4a) | off |
| `-q <res>` | Qualidade (360/480/720/1080/1440/2160) | melhor |
| `-o <dir>` | Diretório de saída | `~/Downloads` |
| `-p` | Modo playlist | off |
| `-b <navegador>` | Navegador para cookies | off |
| `-n` | Sem cookies (padrão) | on |
| `-i` | Apenas informações | off |
| `--lang <code>` | Idioma (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--` | Passar ao yt-dlp | - |

Por padrão, o ytdl funciona sem cookies do navegador. Use `-b <navegador>` para conteúdo restrito (idade, membros, etc.).

## Saída

```
~/Downloads/
  └── Canal/
      └── Título/
          ├── Título.mp4
          ├── Título.jpg           # miniatura
          ├── Título.pt.srt        # legendas
          └── Título.description
```

---

## Plugin Claude Code

Use o ytdl como habilidade do Claude Code. O Claude perguntará interativamente o que baixar usando AskUserQuestion.

### Instalação

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### Uso

Cole uma URL de mídia ou diga "baixe isso" em qualquer conversa do Claude Code. A habilidade é ativada automaticamente e:

1. Verifica se o `ytdl` está instalado (propõe instalação se ausente)
2. Obtém informações da mídia
3. Pergunta o que você deseja (vídeo/áudio, qualidade, local de salvamento)
4. Faz o download

## Isenção de responsabilidade

Este software é fornecido apenas para uso legal. Os autores não são responsáveis por qualquer uso indevido.

## Licença

MIT
