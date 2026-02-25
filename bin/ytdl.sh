#!/bin/bash
# ytdl: media retrieval CLI — yt-dlp wrapper (v2.0)
set -euo pipefail

# --- Color definitions ---
C=$'\033[36m'     # cyan
Y=$'\033[33m'     # yellow
G=$'\033[32m'     # green
R=$'\033[31m'     # red
W=$'\033[1;37m'   # white bold
D=$'\033[2m'      # dim
N=$'\033[0m'      # reset
LINE="${W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"

# --- Language ---
LANG_CODE="ja"

# Parse --lang first (before other opts)
_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang) LANG_CODE="$2"; shift 2 ;;
    *) _ARGS+=("$1"); shift ;;
  esac
done
set -- "${_ARGS[@]+"${_ARGS[@]}"}"

# --- Supported languages check ---
SUPPORTED_LANGS=("ja" "en" "zh-Hans" "es" "hi" "pt" "id")
if [[ ! " ${SUPPORTED_LANGS[@]} " =~ " ${LANG_CODE} " ]]; then
  echo "${R}Error: Unsupported language '${LANG_CODE}'${N}"
  echo "Supported: ${SUPPORTED_LANGS[*]}"
  echo "Use --lang <code> (${SUPPORTED_LANGS[*]}), or set YTDL_LANG environment variable."
  exit 1
fi

# --- i18n ---
case "$LANG_CODE" in
  en)
    L_ERROR_YTDLP="Error: yt-dlp not found"
    L_INSTALL_YTDLP="Install with: brew install yt-dlp"
    L_TITLE="ytdl"
    L_SUBTITLE="— media retrieval CLI"
    L_USAGE="Usage:"
    L_OPTIONS="Options:"
    L_OPT_A="Audio only (m4a)"
    L_OPT_Q="Quality (360/480/720/1080/1440/2160)"
    L_OPT_O="Output directory"
    L_OPT_P="Playlist mode (numbered prefix)"
    L_OPT_B="Cookie browser"
    L_OPT_N="No cookies"
    L_OPT_S="Subtitle languages (e.g. ja,en)"
    L_OPT_I="Show info only (no download)"
    L_OPT_H="Show this help"
    L_OPT_PASS="Pass remaining args to yt-dlp"
    L_EXAMPLES="Examples:"
    L_EX_BEST="# Best quality, full download"
    L_EX_AUDIO="# Audio only"
    L_EX_Q720="# 720p"
    L_EX_PLAYLIST="# Playlist download"
    L_EX_INFO="# Info only"
    L_EX_MUSIC="# Audio to ~/Music"
    L_ERR_RES="Error: Invalid resolution:"
    L_ERR_RES_VALID="Valid values: 360, 480, 720, 1080, 1440, 2160"
    L_ERR_BROWSER="Error: Unsupported browser:"
    L_ERR_UNKNOWN="Error: Unknown option:"
    L_ERR_HELP="Run ytdl -h for help"
    L_ERR_MULTI_URL="Error: Multiple URLs specified"
    L_ERR_NO_URL="Error: Please specify a URL"
    L_FETCHING="Fetching video info..."
    L_ERR_FETCH="Error: Failed to fetch video info"
    L_PY_TITLE="Title:"
    L_PY_CHANNEL="Channel:"
    L_PY_DURATION="Duration:"
    L_PY_UPLOADED="Uploaded:"
    L_PY_VIEWS="Views:"
    L_PY_LIKES="Likes:"
    L_PY_FORMATS="Available formats:"
    L_STARTING="— Starting download"
    L_URL="URL:"
    L_MODE="Mode:"
    L_MODE_AUDIO="Audio only (m4a)"
    L_QUALITY="Quality:"
    L_QUALITY_BEST="Best"
    L_SAVETO="Save to:"
    L_PLAYLIST="Playlist:"
    L_COOKIE="Cookie:"
    L_COOKIE_NONE="none"
    L_EXTRA="Extra args:"
    L_DONE="Download complete"
    L_ERR_DOWNLOAD="Download failed (exit code:"
    L_ERR_DOWNLOAD_CLOSE=")"
    L_PROGRESS="Progress"
    L_SPEED="Speed"
    L_ETA="ETA"
    L_DOWNLOADING="Downloading"
    L_EXTRACTING="Extracting"
    L_MERGING="Merging"
    L_POSTPROCESSING="Post-processing"
    L_WARNINGS_SKIPPED="(repeated warnings hidden)"
    L_ERRORS="Errors"
    L_ERRORS_SUMMARY="Error Summary"
    L_LOG_SAVED="Log saved to:"
    L_DELETE_ASK="Delete downloaded files for this video?"
    L_DELETE_WARN="Channel may have other videos - only this video's files will be deleted."
    L_DELETE_YES="Delete files"
    L_DELETE_NO="Keep files"
    L_DOWNLOADING_TO="Downloading to:"
    L_CANCEL="Cancel"
    L_TRYAGAIN="Try again"
    L_ERROR_HELP="Error Help (for AI):"
    L_ERROR_EXPLANATION="Explanation:"
    L_ERROR_SUGGESTION="Suggestion:"
    L_ERROR_CODE="Error Code:"
    L_VIDEO_DIR="Video directory:"
    L_OPT_TRANSCRIBE="Transcribe after download"
    L_OPT_BACKEND="Transcribe backend (local/api)"
    L_OPT_MANUSCRIPT="Manuscript file path (for accuracy)"
    L_TRANSCRIBE_STARTING="🎙  Starting transcription..."
    L_TRANSCRIBE_DONE="✅ Transcription complete"
    L_TRANSCRIBE_FAILED="❌ Transcription failed"
    ;;
  zh-Hans)
    L_ERROR_YTDLP="错误：未找到 yt-dlp"
    L_INSTALL_YTDLP="请安装：brew install yt-dlp"
    L_TITLE="ytdl"
    L_SUBTITLE="— 媒体获取 CLI"
    L_USAGE="用法："
    L_OPTIONS="选项："
    L_OPT_A="仅音频（m4a）"
    L_OPT_Q="画质（360/480/720/1080/1440/2160）"
    L_OPT_O="输出目录"
    L_OPT_P="播放列表模式（编号前缀）"
    L_OPT_B="Cookie 浏览器"
    L_OPT_N="不使用 Cookie"
    L_OPT_S="字幕语言（例：zh-Hans,en）"
    L_OPT_I="仅显示信息（不下载）"
    L_OPT_H="显示此帮助"
    L_OPT_PASS="将剩余参数传递给 yt-dlp"
    L_EXAMPLES="示例："
    L_EX_BEST="# 最高画质，完整下载"
    L_EX_AUDIO="# 仅音频"
    L_EX_Q720="# 720p"
    L_EX_PLAYLIST="# 播放列表下载"
    L_EX_INFO="# 仅显示信息"
    L_EX_MUSIC="# 音频保存到 ~/Music"
    L_ERR_RES="错误：无效分辨率："
    L_ERR_RES_VALID="有效值：360、480、720、1080、1440、2160"
    L_ERR_BROWSER="错误：不支持的浏览器："
    L_ERR_UNKNOWN="错误：未知选项："
    L_ERR_HELP="运行 ytdl -h 查看帮助"
    L_ERR_MULTI_URL="错误：指定了多个 URL"
    L_ERR_NO_URL="错误：请指定 URL"
    L_FETCHING="正在获取视频信息..."
    L_ERR_FETCH="错误：获取视频信息失败"
    L_PY_TITLE="标题："
    L_PY_CHANNEL="频道："
    L_PY_DURATION="时长："
    L_PY_UPLOADED="发布日期："
    L_PY_VIEWS="播放量："
    L_PY_LIKES="点赞："
    L_PY_FORMATS="可用格式："
    L_STARTING="— 开始下载"
    L_URL="URL："
    L_MODE="模式："
    L_MODE_AUDIO="仅音频（m4a）"
    L_QUALITY="画质："
    L_QUALITY_BEST="最高画质"
    L_SAVETO="保存到："
    L_PLAYLIST="播放列表："
    L_COOKIE="Cookie："
    L_COOKIE_NONE="无"
    L_EXTRA="额外参数："
    L_DONE="下载完成"
    L_ERR_DOWNLOAD="下载失败（退出代码："
    L_ERR_DOWNLOAD_CLOSE="）"
    L_PROGRESS="进度"
    L_SPEED="速度"
    L_ETA="剩余时间"
    L_DOWNLOADING="下载中"
    L_EXTRACTING="提取中"
    L_MERGING="合并中"
    L_POSTPROCESSING="后处理中"
    L_WARNINGS_SKIPPED="（重复警告已隐藏）"
    L_ERRORS="错误"
    L_ERRORS_SUMMARY="错误摘要"
    L_LOG_SAVED="日志已保存到："
    L_DELETE_ASK="删除此视频的文件？"
    L_DELETE_WARN="频道可能有其他视频——仅删除此视频的文件。"
    L_DELETE_YES="删除文件"
    L_DELETE_NO="保留文件"
    L_DOWNLOADING_TO="下载到："
    L_CANCEL="取消"
    L_TRYAGAIN="重试"
    L_ERROR_HELP="错误帮助（AI 用）："
    L_ERROR_EXPLANATION="说明："
    L_ERROR_SUGGESTION="建议："
    L_ERROR_CODE="错误代码："
    L_VIDEO_DIR="视频目录："
    L_OPT_TRANSCRIBE="下载后进行语音转文字"
    L_OPT_BACKEND="转录后端 (local/api)"
    L_OPT_MANUSCRIPT="原稿文件路径（提高准确度）"
    L_TRANSCRIBE_STARTING="🎙  开始语音转文字..."
    L_TRANSCRIBE_DONE="✅ 语音转文字完成"
    L_TRANSCRIBE_FAILED="❌ 语音转文字失败"
    ;;
  es)
    L_ERROR_YTDLP="Error: yt-dlp no encontrado"
    L_INSTALL_YTDLP="Instalar con: brew install yt-dlp"
    L_TITLE="ytdl"
    L_SUBTITLE="— CLI de descarga de medios"
    L_USAGE="Uso:"
    L_OPTIONS="Opciones:"
    L_OPT_A="Solo audio (m4a)"
    L_OPT_Q="Calidad (360/480/720/1080/1440/2160)"
    L_OPT_O="Directorio de salida"
    L_OPT_P="Modo playlist (prefijo numérico)"
    L_OPT_B="Navegador para cookies"
    L_OPT_N="Sin cookies"
    L_OPT_S="Idiomas de subtítulos (ej: es,en)"
    L_OPT_I="Solo información (sin descarga)"
    L_OPT_H="Mostrar esta ayuda"
    L_OPT_PASS="Pasar argumentos restantes a yt-dlp"
    L_EXAMPLES="Ejemplos:"
    L_EX_BEST="# Mejor calidad, descarga completa"
    L_EX_AUDIO="# Solo audio"
    L_EX_Q720="# 720p"
    L_EX_PLAYLIST="# Descarga de playlist"
    L_EX_INFO="# Solo información"
    L_EX_MUSIC="# Audio en ~/Music"
    L_ERR_RES="Error: Resolución inválida:"
    L_ERR_RES_VALID="Valores válidos: 360, 480, 720, 1080, 1440, 2160"
    L_ERR_BROWSER="Error: Navegador no soportado:"
    L_ERR_UNKNOWN="Error: Opción desconocida:"
    L_ERR_HELP="Ejecute ytdl -h para ayuda"
    L_ERR_MULTI_URL="Error: Se especificaron múltiples URLs"
    L_ERR_NO_URL="Error: Especifique una URL"
    L_FETCHING="Obteniendo información del video..."
    L_ERR_FETCH="Error: No se pudo obtener la información del video"
    L_PY_TITLE="Título:"
    L_PY_CHANNEL="Canal:"
    L_PY_DURATION="Duración:"
    L_PY_UPLOADED="Publicado:"
    L_PY_VIEWS="Vistas:"
    L_PY_LIKES="Me gusta:"
    L_PY_FORMATS="Formatos disponibles:"
    L_STARTING="— Iniciando descarga"
    L_URL="URL:"
    L_MODE="Modo:"
    L_MODE_AUDIO="Solo audio (m4a)"
    L_QUALITY="Calidad:"
    L_QUALITY_BEST="Mejor"
    L_SAVETO="Guardar en:"
    L_PLAYLIST="Playlist:"
    L_COOKIE="Cookie:"
    L_COOKIE_NONE="ninguna"
    L_EXTRA="Args extra:"
    L_DONE="Descarga completa"
    L_ERR_DOWNLOAD="Descarga fallida (código de salida:"
    L_ERR_DOWNLOAD_CLOSE=")"
    L_PROGRESS="Progreso"
    L_SPEED="Velocidad"
    L_ETA="Tiempo restante"
    L_DOWNLOADING="Descargando"
    L_EXTRACTING="Extrayendo"
    L_MERGING="Fusionando"
    L_POSTPROCESSING="Post-procesando"
    L_WARNINGS_SKIPPED="(advertencias repetidas ocultas)"
    L_ERRORS="Errores"
    L_ERRORS_SUMMARY="Resumen de errores"
    L_LOG_SAVED="Log guardado en:"
    L_DELETE_ASK="¿Eliminar los archivos de este video?"
    L_DELETE_WARN="El canal puede tener otros videos — solo se eliminarán los archivos de este video."
    L_DELETE_YES="Eliminar archivos"
    L_DELETE_NO="Conservar archivos"
    L_DOWNLOADING_TO="Descargando en:"
    L_CANCEL="Cancelar"
    L_TRYAGAIN="Reintentar"
    L_ERROR_HELP="Ayuda de error (para IA):"
    L_ERROR_EXPLANATION="Explicación:"
    L_ERROR_SUGGESTION="Sugerencia:"
    L_ERROR_CODE="Código de error:"
    L_VIDEO_DIR="Directorio del video:"
    L_OPT_TRANSCRIBE="Transcribir después de descargar"
    L_OPT_BACKEND="Backend de transcripción (local/api)"
    L_OPT_MANUSCRIPT="Ruta del manuscrito (para precisión)"
    L_TRANSCRIBE_STARTING="🎙  Iniciando transcripción..."
    L_TRANSCRIBE_DONE="✅ Transcripción completada"
    L_TRANSCRIBE_FAILED="❌ Transcripción fallida"
    ;;
  hi)
    L_ERROR_YTDLP="त्रुटि: yt-dlp नहीं मिला"
    L_INSTALL_YTDLP="इंस्टॉल करें: brew install yt-dlp"
    L_TITLE="ytdl"
    L_SUBTITLE="— मीडिया डाउनलोड CLI"
    L_USAGE="उपयोग:"
    L_OPTIONS="विकल्प:"
    L_OPT_A="केवल ऑडियो (m4a)"
    L_OPT_Q="गुणवत्ता (360/480/720/1080/1440/2160)"
    L_OPT_O="आउटपुट डायरेक्टरी"
    L_OPT_P="प्लेलिस्ट मोड (क्रमांक उपसर्ग)"
    L_OPT_B="कुकी ब्राउज़र"
    L_OPT_N="कुकी के बिना"
    L_OPT_S="उपशीर्षक भाषाएँ (उदा: hi,en)"
    L_OPT_I="केवल जानकारी (डाउनलोड नहीं)"
    L_OPT_H="यह सहायता दिखाएँ"
    L_OPT_PASS="शेष args को yt-dlp को पास करें"
    L_EXAMPLES="उदाहरण:"
    L_EX_BEST="# सर्वश्रेष्ठ गुणवत्ता, पूर्ण डाउनलोड"
    L_EX_AUDIO="# केवल ऑडियो"
    L_EX_Q720="# 720p"
    L_EX_PLAYLIST="# प्लेलिस्ट डाउनलोड"
    L_EX_INFO="# केवल जानकारी"
    L_EX_MUSIC="# ऑडियो ~/Music में"
    L_ERR_RES="त्रुटि: अमान्य रिज़ॉल्यूशन:"
    L_ERR_RES_VALID="मान्य मान: 360, 480, 720, 1080, 1440, 2160"
    L_ERR_BROWSER="त्रुटि: असमर्थित ब्राउज़र:"
    L_ERR_UNKNOWN="त्रुटि: अज्ञात विकल्प:"
    L_ERR_HELP="सहायता के लिए ytdl -h चलाएँ"
    L_ERR_MULTI_URL="त्रुटि: एकाधिक URL निर्दिष्ट"
    L_ERR_NO_URL="त्रुटि: कृपया URL निर्दिष्ट करें"
    L_FETCHING="वीडियो जानकारी प्राप्त हो रही है..."
    L_ERR_FETCH="त्रुटि: वीडियो जानकारी प्राप्त करने में विफल"
    L_PY_TITLE="शीर्षक:"
    L_PY_CHANNEL="चैनल:"
    L_PY_DURATION="अवधि:"
    L_PY_UPLOADED="अपलोड:"
    L_PY_VIEWS="व्यू:"
    L_PY_LIKES="लाइक:"
    L_PY_FORMATS="उपलब्ध प्रारूप:"
    L_STARTING="— डाउनलोड शुरू"
    L_URL="URL:"
    L_MODE="मोड:"
    L_MODE_AUDIO="केवल ऑडियो (m4a)"
    L_QUALITY="गुणवत्ता:"
    L_QUALITY_BEST="सर्वश्रेष्ठ"
    L_SAVETO="यहाँ सेव करें:"
    L_PLAYLIST="प्लेलिस्ट:"
    L_COOKIE="कुकी:"
    L_COOKIE_NONE="कोई नहीं"
    L_EXTRA="अतिरिक्त args:"
    L_DONE="डाउनलोड पूर्ण"
    L_ERR_DOWNLOAD="डाउनलोड विफल (एग्ज़िट कोड:"
    L_ERR_DOWNLOAD_CLOSE=")"
    L_PROGRESS="प्रगति"
    L_SPEED="गति"
    L_ETA="शेष समय"
    L_DOWNLOADING="डाउनलोड हो रहा है"
    L_EXTRACTING="निकाला जा रहा है"
    L_MERGING="मर्ज हो रहा है"
    L_POSTPROCESSING="पोस्ट-प्रोसेसिंग"
    L_WARNINGS_SKIPPED="(दोहराई गई चेतावनियाँ छिपाई गईं)"
    L_ERRORS="त्रुटियाँ"
    L_ERRORS_SUMMARY="त्रुटि सारांश"
    L_LOG_SAVED="लॉग सेव हुआ:"
    L_DELETE_ASK="इस वीडियो की फ़ाइलें हटाएँ?"
    L_DELETE_WARN="चैनल में अन्य वीडियो हो सकते हैं — केवल इस वीडियो की फ़ाइलें हटाई जाएँगी।"
    L_DELETE_YES="फ़ाइलें हटाएँ"
    L_DELETE_NO="फ़ाइलें रखें"
    L_DOWNLOADING_TO="यहाँ डाउनलोड हो रहा है:"
    L_CANCEL="रद्द"
    L_TRYAGAIN="पुनः प्रयास"
    L_ERROR_HELP="त्रुटि सहायता (AI हेतु):"
    L_ERROR_EXPLANATION="व्याख्या:"
    L_ERROR_SUGGESTION="सुझाव:"
    L_ERROR_CODE="त्रुटि कोड:"
    L_VIDEO_DIR="वीडियो डायरेक्टरी:"
    L_OPT_TRANSCRIBE="डाउनलोड के बाद ट्रांसक्राइब"
    L_OPT_BACKEND="ट्रांसक्रिप्शन बैकेंड (local/api)"
    L_OPT_MANUSCRIPT="पांडुलिपि फ़ाइल पथ (सटीकता के लिए)"
    L_TRANSCRIBE_STARTING="🎙  ट्रांसक्रिप्शन शुरू..."
    L_TRANSCRIBE_DONE="✅ ट्रांसक्रिप्शन पूर्ण"
    L_TRANSCRIBE_FAILED="❌ ट्रांसक्रिप्शन विफल"
    ;;
  pt)
    L_ERROR_YTDLP="Erro: yt-dlp não encontrado"
    L_INSTALL_YTDLP="Instale com: brew install yt-dlp"
    L_TITLE="ytdl"
    L_SUBTITLE="— CLI de download de mídia"
    L_USAGE="Uso:"
    L_OPTIONS="Opções:"
    L_OPT_A="Somente áudio (m4a)"
    L_OPT_Q="Qualidade (360/480/720/1080/1440/2160)"
    L_OPT_O="Diretório de saída"
    L_OPT_P="Modo playlist (prefixo numérico)"
    L_OPT_B="Navegador para cookies"
    L_OPT_N="Sem cookies"
    L_OPT_S="Idiomas de legendas (ex: pt,en)"
    L_OPT_I="Apenas informações (sem download)"
    L_OPT_H="Mostrar esta ajuda"
    L_OPT_PASS="Passar argumentos restantes ao yt-dlp"
    L_EXAMPLES="Exemplos:"
    L_EX_BEST="# Melhor qualidade, download completo"
    L_EX_AUDIO="# Somente áudio"
    L_EX_Q720="# 720p"
    L_EX_PLAYLIST="# Download de playlist"
    L_EX_INFO="# Apenas informações"
    L_EX_MUSIC="# Áudio em ~/Music"
    L_ERR_RES="Erro: Resolução inválida:"
    L_ERR_RES_VALID="Valores válidos: 360, 480, 720, 1080, 1440, 2160"
    L_ERR_BROWSER="Erro: Navegador não suportado:"
    L_ERR_UNKNOWN="Erro: Opção desconhecida:"
    L_ERR_HELP="Execute ytdl -h para ajuda"
    L_ERR_MULTI_URL="Erro: Múltiplas URLs especificadas"
    L_ERR_NO_URL="Erro: Especifique uma URL"
    L_FETCHING="Obtendo informações do vídeo..."
    L_ERR_FETCH="Erro: Falha ao obter informações do vídeo"
    L_PY_TITLE="Título:"
    L_PY_CHANNEL="Canal:"
    L_PY_DURATION="Duração:"
    L_PY_UPLOADED="Publicado:"
    L_PY_VIEWS="Visualizações:"
    L_PY_LIKES="Curtidas:"
    L_PY_FORMATS="Formatos disponíveis:"
    L_STARTING="— Iniciando download"
    L_URL="URL:"
    L_MODE="Modo:"
    L_MODE_AUDIO="Somente áudio (m4a)"
    L_QUALITY="Qualidade:"
    L_QUALITY_BEST="Melhor"
    L_SAVETO="Salvar em:"
    L_PLAYLIST="Playlist:"
    L_COOKIE="Cookie:"
    L_COOKIE_NONE="nenhum"
    L_EXTRA="Args extras:"
    L_DONE="Download concluído"
    L_ERR_DOWNLOAD="Download falhou (código de saída:"
    L_ERR_DOWNLOAD_CLOSE=")"
    L_PROGRESS="Progresso"
    L_SPEED="Velocidade"
    L_ETA="Tempo restante"
    L_DOWNLOADING="Baixando"
    L_EXTRACTING="Extraindo"
    L_MERGING="Mesclando"
    L_POSTPROCESSING="Pós-processando"
    L_WARNINGS_SKIPPED="(avisos repetidos ocultos)"
    L_ERRORS="Erros"
    L_ERRORS_SUMMARY="Resumo de erros"
    L_LOG_SAVED="Log salvo em:"
    L_DELETE_ASK="Excluir os arquivos deste vídeo?"
    L_DELETE_WARN="O canal pode ter outros vídeos — apenas os arquivos deste vídeo serão excluídos."
    L_DELETE_YES="Excluir arquivos"
    L_DELETE_NO="Manter arquivos"
    L_DOWNLOADING_TO="Baixando em:"
    L_CANCEL="Cancelar"
    L_TRYAGAIN="Tentar novamente"
    L_ERROR_HELP="Ajuda de erro (para IA):"
    L_ERROR_EXPLANATION="Explicação:"
    L_ERROR_SUGGESTION="Sugestão:"
    L_ERROR_CODE="Código de erro:"
    L_VIDEO_DIR="Diretório do vídeo:"
    L_OPT_TRANSCRIBE="Transcrever após download"
    L_OPT_BACKEND="Backend de transcrição (local/api)"
    L_OPT_MANUSCRIPT="Caminho do manuscrito (para precisão)"
    L_TRANSCRIBE_STARTING="🎙  Iniciando transcrição..."
    L_TRANSCRIBE_DONE="✅ Transcrição concluída"
    L_TRANSCRIBE_FAILED="❌ Transcrição falhou"
    ;;
  id)
    L_ERROR_YTDLP="Error: yt-dlp tidak ditemukan"
    L_INSTALL_YTDLP="Instal dengan: brew install yt-dlp"
    L_TITLE="ytdl"
    L_SUBTITLE="— CLI unduh media"
    L_USAGE="Penggunaan:"
    L_OPTIONS="Opsi:"
    L_OPT_A="Audio saja (m4a)"
    L_OPT_Q="Kualitas (360/480/720/1080/1440/2160)"
    L_OPT_O="Direktori output"
    L_OPT_P="Mode playlist (prefiks nomor)"
    L_OPT_B="Browser cookie"
    L_OPT_N="Tanpa cookie"
    L_OPT_S="Bahasa subtitle (contoh: id,en)"
    L_OPT_I="Tampilkan info saja (tanpa unduhan)"
    L_OPT_H="Tampilkan bantuan ini"
    L_OPT_PASS="Teruskan argumen ke yt-dlp"
    L_EXAMPLES="Contoh:"
    L_EX_BEST="# Kualitas terbaik, unduh lengkap"
    L_EX_AUDIO="# Audio saja"
    L_EX_Q720="# 720p"
    L_EX_PLAYLIST="# Unduh playlist"
    L_EX_INFO="# Info saja"
    L_EX_MUSIC="# Audio ke ~/Music"
    L_ERR_RES="Error: Resolusi tidak valid:"
    L_ERR_RES_VALID="Nilai valid: 360, 480, 720, 1080, 1440, 2160"
    L_ERR_BROWSER="Error: Browser tidak didukung:"
    L_ERR_UNKNOWN="Error: Opsi tidak dikenal:"
    L_ERR_HELP="Jalankan ytdl -h untuk bantuan"
    L_ERR_MULTI_URL="Error: Beberapa URL diberikan"
    L_ERR_NO_URL="Error: Harap tentukan URL"
    L_FETCHING="Mengambil info video..."
    L_ERR_FETCH="Error: Gagal mengambil info video"
    L_PY_TITLE="Judul:"
    L_PY_CHANNEL="Channel:"
    L_PY_DURATION="Durasi:"
    L_PY_UPLOADED="Diunggah:"
    L_PY_VIEWS="Ditonton:"
    L_PY_LIKES="Suka:"
    L_PY_FORMATS="Format tersedia:"
    L_STARTING="— Memulai unduhan"
    L_URL="URL:"
    L_MODE="Mode:"
    L_MODE_AUDIO="Audio saja (m4a)"
    L_QUALITY="Kualitas:"
    L_QUALITY_BEST="Terbaik"
    L_SAVETO="Simpan ke:"
    L_PLAYLIST="Playlist:"
    L_COOKIE="Cookie:"
    L_COOKIE_NONE="tidak ada"
    L_EXTRA="Args tambahan:"
    L_DONE="Unduhan selesai"
    L_ERR_DOWNLOAD="Unduhan gagal (kode keluar:"
    L_ERR_DOWNLOAD_CLOSE=")"
    L_PROGRESS="Progres"
    L_SPEED="Kecepatan"
    L_ETA="Sisa waktu"
    L_DOWNLOADING="Mengunduh"
    L_EXTRACTING="Mengekstrak"
    L_MERGING="Menggabungkan"
    L_POSTPROCESSING="Pasca-pemrosesan"
    L_WARNINGS_SKIPPED="(peringatan berulang disembunyikan)"
    L_ERRORS="Error"
    L_ERRORS_SUMMARY="Ringkasan Error"
    L_LOG_SAVED="Log disimpan di:"
    L_DELETE_ASK="Hapus file video ini?"
    L_DELETE_WARN="Channel mungkin memiliki video lain — hanya file video ini yang akan dihapus."
    L_DELETE_YES="Hapus file"
    L_DELETE_NO="Simpan file"
    L_DOWNLOADING_TO="Mengunduh ke:"
    L_CANCEL="Batal"
    L_TRYAGAIN="Coba lagi"
    L_ERROR_HELP="Bantuan Error (untuk AI):"
    L_ERROR_EXPLANATION="Penjelasan:"
    L_ERROR_SUGGESTION="Saran:"
    L_ERROR_CODE="Kode Error:"
    L_VIDEO_DIR="Direktori video:"
    L_OPT_TRANSCRIBE="Transkrip setelah unduh"
    L_OPT_BACKEND="Backend transkripsi (local/api)"
    L_OPT_MANUSCRIPT="Path file manuskrip (untuk akurasi)"
    L_TRANSCRIBE_STARTING="🎙  Memulai transkripsi..."
    L_TRANSCRIBE_DONE="✅ Transkripsi selesai"
    L_TRANSCRIBE_FAILED="❌ Transkripsi gagal"
    ;;
  *) # ja (default)
    L_ERROR_YTDLP="エラー: yt-dlp が見つかりません"
    L_INSTALL_YTDLP="brew install yt-dlp  でインストールしてください"
    L_TITLE="ytdl"
    L_SUBTITLE="— メディア取得 CLI"
    L_USAGE="使い方:"
    L_OPTIONS="オプション:"
    L_OPT_A="音声のみ（m4a）"
    L_OPT_Q="画質指定（360/480/720/1080/1440/2160）"
    L_OPT_O="保存先ディレクトリ"
    L_OPT_P="プレイリストモード（番号プレフィックス付き）"
    L_OPT_B="クッキー取得元ブラウザ"
    L_OPT_N="クッキーなしで実行"
    L_OPT_S="字幕言語（例: ja,en）"
    L_OPT_I="動画情報のみ表示（DLしない）"
    L_OPT_H="このヘルプを表示"
    L_OPT_PASS="以降を yt-dlp に直接渡す"
    L_EXAMPLES="例:"
    L_EX_BEST="# 最高画質で全部入りDL"
    L_EX_AUDIO="# 音声のみ"
    L_EX_Q720="# 720p指定"
    L_EX_PLAYLIST="# プレイリスト一括"
    L_EX_INFO="# 情報のみ表示"
    L_EX_MUSIC="# 音声を~/Musicに保存"
    L_ERR_RES="エラー: 無効な解像度:"
    L_ERR_RES_VALID="有効な値: 360, 480, 720, 1080, 1440, 2160"
    L_ERR_BROWSER="エラー: 未対応のブラウザ:"
    L_ERR_UNKNOWN="エラー: 不明なオプション:"
    L_ERR_HELP="ytdl -h でヘルプを表示"
    L_ERR_MULTI_URL="エラー: URLが複数指定されています"
    L_ERR_NO_URL="エラー: URLを指定してください"
    L_FETCHING="動画情報を取得中..."
    L_ERR_FETCH="エラー: 動画情報の取得に失敗しました"
    L_PY_TITLE="タイトル:"
    L_PY_CHANNEL="チャンネル:"
    L_PY_DURATION="再生時間:"
    L_PY_UPLOADED="公開日:"
    L_PY_VIEWS="視聴回数:"
    L_PY_LIKES="高評価:"
    L_PY_FORMATS="利用可能フォーマット:"
    L_STARTING="— ダウンロード開始"
    L_URL="URL:"
    L_MODE="モード:"
    L_MODE_AUDIO="音声のみ (m4a)"
    L_QUALITY="画質:"
    L_QUALITY_BEST="最高画質"
    L_SAVETO="保存先:"
    L_PLAYLIST="プレイリスト:"
    L_COOKIE="クッキー:"
    L_COOKIE_NONE="なし"
    L_EXTRA="追加引数:"
    L_DONE="ダウンロード完了"
    L_ERR_DOWNLOAD="ダウンロード失敗（終了コード:"
    L_ERR_DOWNLOAD_CLOSE="）"
    L_PROGRESS="進捗"
    L_SPEED="速度"
    L_ETA="残り時間"
    L_DOWNLOADING="ダウンロード中"
    L_EXTRACTING="抽出中"
    L_MERGING="マージ中"
    L_POSTPROCESSING="後処理中"
    L_WARNINGS_SKIPPED="（重複警告は省略）"
    L_ERRORS="エラー"
    L_ERRORS_SUMMARY="エラー概要"
    L_LOG_SAVED="ログを保存しました:"
    L_DELETE_ASK="この動画のファイルを削除しますか？"
    L_DELETE_WARN="チャンネルには他の動画があるかもしれないため、チャンネルは削除せずこの動画のみ削除します。"
    L_DELETE_YES="削除する"
    L_DELETE_NO="残す"
    L_DOWNLOADING_TO="保存先:"
    L_CANCEL="キャンセル"
    L_TRYAGAIN="再試行"
    L_ERROR_HELP="エラー help (AI用):"
    L_ERROR_EXPLANATION="説明:"
    L_ERROR_SUGGESTION="提案:"
    L_ERROR_CODE="エラーコード:"
    L_VIDEO_DIR="動画ディレクトリ:"
    L_OPT_TRANSCRIBE="ダウンロード後に文字起こし"
    L_OPT_BACKEND="文字起こしバックエンド (local/api)"
    L_OPT_MANUSCRIPT="原稿ファイルパス（精度向上用）"
    L_TRANSCRIBE_STARTING="🎙  文字起こし開始..."
    L_TRANSCRIBE_DONE="✅ 文字起こし完了"
    L_TRANSCRIBE_FAILED="❌ 文字起こし失敗"
    ;;
esac

# --- Progress bar functions ---
PROGRESS_BAR_WIDTH=40
CURRENT_PHASE=""
CURRENT_PROGRESS=0
CURRENT_TOTAL=100
CURRENT_SPEED=""
CURRENT_ETA=""

init_progress() {
  CURRENT_PHASE="$1"
  CURRENT_PROGRESS=0
  CURRENT_TOTAL=100
  CURRENT_SPEED=""
  CURRENT_ETA=""
}

update_progress() {
  local phase="$1"
  local progress="$2"
  local total="$3"
  local speed="$4"
  local eta="$5"

  [[ -n "$phase" ]] && CURRENT_PHASE="$phase"
  [[ -n "$progress" ]] && CURRENT_PROGRESS="$progress"
  [[ -n "$total" ]] && CURRENT_TOTAL="$total"
  [[ -n "$speed" ]] && CURRENT_SPEED="$speed"
  [[ -n "$eta" ]] && CURRENT_ETA="$eta"

  draw_progress
}

draw_progress() {
  local percent=0
  if [[ $CURRENT_TOTAL -gt 0 ]]; then
    percent=$((CURRENT_PROGRESS * 100 / CURRENT_TOTAL))
  fi
  [[ $percent -gt 100 ]] && percent=100
  [[ $percent -lt 0 ]] && percent=0

  local filled=0
  if [[ $CURRENT_TOTAL -gt 0 ]]; then
    filled=$((PROGRESS_BAR_WIDTH * CURRENT_PROGRESS / CURRENT_TOTAL))
  fi
  [[ $filled -gt $PROGRESS_BAR_WIDTH ]] && filled=$PROGRESS_BAR_WIDTH
  local empty=$((PROGRESS_BAR_WIDTH - filled))

  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done

  local info=""
  [[ -n "$CURRENT_SPEED" ]] && info+=" ${C}${L_SPEED}:${N} $CURRENT_SPEED"
  [[ -n "$CURRENT_ETA" ]] && info+=" ${C}${L_ETA}:${N} $CURRENT_ETA"

  printf "\r\033[K${C}[${bar}]${N} ${G}%3d%%${N}%s" "$percent" "$info"
}

# --- Warning deduplication ---
WARNING_LOG_FILE=""
WARNING_COUNT=0
SKIPPED_WARNING_COUNT=0

init_warning_tracker() {
  local timestamp
  timestamp=$(date +"%Y%m%d_%H%M%S")
  WARNING_LOG_FILE="/tmp/ytdl_warnings_${timestamp}.txt"
  > "$WARNING_LOG_FILE"
}

process_warning() {
  local warning="$1"
  local key="$warning"

  key="${key//\[download\] /}"
  key="${key//\[info\] /}"
  key="${key//\[error\] /}"

  if ! grep -qF -- "$key" "$WARNING_LOG_FILE" 2>/dev/null; then
    echo "$key" >> "$WARNING_LOG_FILE"
    WARNING_COUNT=$((WARNING_COUNT + 1))
    echo "${Y}⚠ ${warning}${N}" >&2
  else
    SKIPPED_WARNING_COUNT=$((SKIPPED_WARNING_COUNT + 1))
  fi
}

cleanup_warning_tracker() {
  if [[ -n "$WARNING_LOG_FILE" && -f "$WARNING_LOG_FILE" ]]; then
    rm -f "$WARNING_LOG_FILE"
  fi
}

# --- Log file ---
LOG_FILE=""

setup_log() {
  local timestamp
  timestamp=$(date +"%Y%m%d_%H%M%S")
  LOG_FILE="${BASE_DIR}/ytdl_${timestamp}.log"

  {
    echo "=== ytdl Log ==="
    echo "Date: $(date)"
    echo "URL: $URL"
    echo "Mode: $MODE"
    echo "Quality: $QUALITY"
    echo "Output: $BASE_DIR"
    echo "==============="
    echo ""
  } > "$LOG_FILE"
}

log_msg() {
  echo "$1" >> "$LOG_FILE"
}

close_log() {
  :
}

# --- Error tracking (file-based) ---
ERROR_LOG_FILE=""

init_error_tracker() {
  local timestamp
  timestamp=$(date +"%Y%m%d_%H%M%S")
  ERROR_LOG_FILE="/tmp/ytdl_errors_${timestamp}.txt"
  > "$ERROR_LOG_FILE"
}

add_error() {
  local error_code="$1"
  local error_msg="$2"

  echo "[$error_code] $error_msg" >> "$ERROR_LOG_FILE"
}

cleanup_error_tracker() {
  if [[ -n "$ERROR_LOG_FILE" && -f "$ERROR_LOG_FILE" ]]; then
    rm -f "$ERROR_LOG_FILE"
  fi
}

get_error_explanation() {
  local err="$1"

  case "$err" in
    *"HTTP Error 429"*)
      echo "YouTube rate limited the request (Too Many Requests).";;
    *"Unable to download video subtitles"*)
      echo "Video subtitles could not be downloaded.";;
    *"Signatures are unavailable"*)
      echo "YouTube updated their encryption. Update yt-dlp.";;
    *"Unable to extract"*)
      echo "Could not extract video information.";;
    *"Video unavailable"*)
      echo "The video has been removed or made private.";;
    *"This video is available only"*)
      echo "Video is not available in your region.";;
    *)
      echo "General yt-dlp error. Check the error message above.";;
  esac
}

get_error_suggestion() {
  local err="$1"

  case "$err" in
    *"HTTP Error 429"*)
      echo "Wait a while and retry, or use --cookies-from-browser.";;
    *"Unable to download video subtitles"*)
      echo "Try without subtitles using --no-subs or specific subtitle languages.";;
    *"Signatures are unavailable"*)
      echo "Update yt-dlp: pip install -U yt-dlp";;
    *"Unable to extract"*)
      echo "Video may be private, age-restricted, or region-locked.";;
    *"Video unavailable"*)
      echo "Verify the video URL is correct.";;
    *"This video is available only"*)
      echo "Use proxy or cookies from a different region.";;
    *)
      echo "Check the error message and try different options.";;
  esac
}

# --- Output parser for yt-dlp ---
parse_yt_dlp_output() {
  while IFS= read -r line; do
    log_msg "$line"

    # Skip empty lines
    [[ -z "$line" ]] && continue

    # Progress lines
    if [[ "$line" =~ \[download\]\ *([0-9.]+)% ]]; then
      local percent="${BASH_REMATCH[1]}"
      CURRENT_PROGRESS="${percent%.*}"

      if [[ "$line" =~ at\ +([^ ]+iB/s) ]]; then
        CURRENT_SPEED="${BASH_REMATCH[1]}"
      fi
      if [[ "$line" =~ ETA\ +([0-9:]+) ]]; then
        CURRENT_ETA="${BASH_REMATCH[1]}"
      fi
      draw_progress
      continue
    fi

    # Phase detection — print phase label on new line, then start fresh progress
    if [[ "$line" =~ \[download\]\ *Downloading\ *.*:\ *(.*) ]]; then
      echo ""
      echo "${C}  ${L_DOWNLOADING}: ${BASH_REMATCH[1]}${N}"
      init_progress "${L_DOWNLOADING}"
    elif [[ "$line" =~ \[download\]\ *Destination\ *(.*) ]]; then
      : # destination info already in download phase
    elif [[ "$line" =~ \[download\]\ *Merging ]]; then
      echo ""
      echo "${C}  ${L_MERGING}${N}"
      init_progress "${L_MERGING}"
    elif [[ "$line" =~ \[extractaudio\] ]]; then
      echo ""
      echo "${C}  ${L_EXTRACTING}${N}"
      init_progress "${L_EXTRACTING}"
    elif [[ "$line" =~ \[Thumbnails\] ]]; then
      : # thumbnail processing, no progress bar needed
    elif [[ "$line" =~ \[Subtitles\] ]]; then
      : # subtitles processing, no progress bar needed
    fi

    # Handle warnings
    if [[ "$line" =~ ^WARNING ]]; then
      process_warning "${line#WARNING }"
      continue
    fi

    # Handle errors
    if [[ "$line" =~ ^ERROR ]]; then
      local err_msg="${line#ERROR }"
      echo "${R}✗ ${err_msg}${N}" >&2
      log_msg "ERROR: $err_msg"
      add_error "$err_msg" "$err_msg"
      continue
    fi

    # Regular output
    if [[ -n "$line" && ! "$line" =~ ^\[ ]]; then
      echo "$line"
    fi
  done
}

# --- yt-dlp existence check ---
if ! command -v yt-dlp &>/dev/null; then
  echo "${R}${L_ERROR_YTDLP}${N}"
  echo "  ${L_INSTALL_YTDLP}"
  exit 1
fi

# --- Help ---
show_help() {
  echo ""
  echo "${LINE}"
  echo "${C}  ${L_TITLE}${N}  ${D}${L_SUBTITLE}${N}"
  echo "${LINE}"
  echo ""
  echo "${W}${L_USAGE}${N}  ytdl [options] <URL> [-- yt-dlp options...]"
  echo ""
  echo "${W}${L_OPTIONS}${N}"
  echo "  ${G}-a${N}             ${L_OPT_A}"
  echo "  ${G}-q${N} <res>       ${L_OPT_Q}"
  echo "  ${G}-o${N} <dir>       ${L_OPT_O}  ${D}[~/Downloads]${N}"
  echo "  ${G}-p${N}             ${L_OPT_P}"
  echo "  ${G}-b${N} <browser>   ${L_OPT_B}  ${D}[off]${N}"
  echo "  ${G}-n${N}             ${L_OPT_N}"
  echo "  ${G}-s${N} <langs>     ${L_OPT_S}  ${D}[auto]${N}"
  echo "  ${G}-i${N}             ${L_OPT_I}"
  echo "  ${G}-t${N}             ${L_OPT_TRANSCRIBE}"
  echo "  ${G}--backend${N} <b>  ${L_OPT_BACKEND}  ${D}[local]${N}"
  echo "  ${G}--manuscript${N} <path>  ${L_OPT_MANUSCRIPT}"
  echo "  ${G}-h${N}             ${L_OPT_H}"
  echo "  ${G}--${N}             ${L_OPT_PASS}"
  echo ""
  echo "${W}${L_EXAMPLES}${N}"
  echo "  ${C}ytdl \"https://youtu.be/xxxxx\"${N}              ${D}${L_EX_BEST}${N}"
  echo "  ${C}ytdl -a \"https://youtu.be/xxxxx\"${N}           ${D}${L_EX_AUDIO}${N}"
  echo "  ${C}ytdl -q 720 \"https://youtu.be/xxxxx\"${N}       ${D}${L_EX_Q720}${N}"
  echo "  ${C}ytdl -p \"https://youtube.com/playlist?...\"${N} ${D}${L_EX_PLAYLIST}${N}"
  echo "  ${C}ytdl -i \"https://youtu.be/xxxxx\"${N}           ${D}${L_EX_INFO}${N}"
  echo "  ${C}ytdl -a -o ~/Music \"https://youtu.be/...\"${N}  ${D}${L_EX_MUSIC}${N}"
  echo ""
}

# --- Defaults ---
AUDIO_ONLY=false
QUALITY=""
BASE_DIR="$HOME/Downloads"
PLAYLIST_MODE=false
BROWSER="chrome"
NO_COOKIE=true
INFO_ONLY=false
SUB_LANGS=""
URL=""
TRANSCRIBE=false
TRANSCRIBE_BACKEND="local"
TRANSCRIBE_MANUSCRIPT=""
EXTRA_ARGS=()

# --- Parse options ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a) AUDIO_ONLY=true; shift ;;
    -q)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_RES} (empty)${N}"; echo "  ${D}${L_ERR_RES_VALID}${N}"; exit 1
      fi
      case "$2" in
        360|480|720|1080|1440|2160) QUALITY="$2" ;;
        *) echo "${R}${L_ERR_RES} $2${N}"; echo "  ${D}${L_ERR_RES_VALID}${N}"; exit 1 ;;
      esac
      shift 2 ;;
    -o)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_UNKNOWN} -o (no value)${N}"; exit 1
      fi
      BASE_DIR="$2"; shift 2 ;;
    -p) PLAYLIST_MODE=true; shift ;;
    -b)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_BROWSER} (empty)${N}"; exit 1
      fi
      case "$2" in
        chrome|firefox|edge|safari|opera|brave|chromium|vivaldi) BROWSER="$2" ;;
        *) echo "${R}${L_ERR_BROWSER} $2${N}"; exit 1 ;;
      esac
      NO_COOKIE=false
      shift 2 ;;
    -n) NO_COOKIE=true; shift ;;
    -s)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_UNKNOWN} -s (no value)${N}"; exit 1
      fi
      SUB_LANGS="$2"; shift 2 ;;
    -i) INFO_ONLY=true; shift ;;
    -t|--transcribe) TRANSCRIBE=true; shift ;;
    --backend)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}--backend requires a value${N}"; exit 1
      fi
      TRANSCRIBE_BACKEND="$2"; shift 2 ;;
    --manuscript)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}--manuscript requires a value${N}"; exit 1
      fi
      TRANSCRIBE_MANUSCRIPT="$2"; shift 2 ;;
    -h|--help) show_help; exit 0 ;;
    --)
      shift
      EXTRA_ARGS=("$@")
      break
      ;;
    -*)
      echo "${R}${L_ERR_UNKNOWN} $1${N}"
      echo "  ${D}${L_ERR_HELP}${N}"
      exit 1
      ;;
    *)
      if [[ -z "$URL" ]]; then
        URL="$1"
      else
        echo "${R}${L_ERR_MULTI_URL}${N}"
        exit 1
      fi
      shift
      ;;
  esac
done

# --- URL required ---
if [[ -z "$URL" ]]; then
  echo "${R}${L_ERR_NO_URL}${N}"
  echo "  ${D}${L_ERR_HELP}${N}"
  exit 1
fi

# --- Info mode ---
if [[ "$INFO_ONLY" == true ]]; then
  echo ""
  echo "${LINE}"
  echo "${C}  ${L_FETCHING}${N}"
  echo "${LINE}"
  echo ""

  YT_ARGS=(--ignore-config --dump-json --no-download)
  if [[ "$NO_COOKIE" == false ]]; then
    YT_ARGS+=(--cookies-from-browser "$BROWSER")
  fi

  RAW_JSON=$(yt-dlp "${YT_ARGS[@]}" "$URL" 2>/dev/null) || {
    echo "${R}${L_ERR_FETCH}${N}"
    exit 1
  }

  echo "$RAW_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
dur = d.get('duration', 0)
h, m, s = dur // 3600, (dur % 3600) // 60, dur % 60
dur_str = f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'
upload = d.get('upload_date', '')
if upload:
    upload = f'{upload[:4]}-{upload[4:6]}-{upload[6:]}'

labels = {
    'title': '${L_PY_TITLE}',
    'channel': '${L_PY_CHANNEL}',
    'duration': '${L_PY_DURATION}',
    'uploaded': '${L_PY_UPLOADED}',
    'views': '${L_PY_VIEWS}',
    'likes': '${L_PY_LIKES}',
    'formats': '${L_PY_FORMATS}',
}

W = '\033[1;37m'
G = '\033[32m'
N = '\033[0m'

print(f'  {W}{labels[\"title\"]}{N}    {d.get(\"title\", \"N/A\")}')
print(f'  {W}{labels[\"channel\"]}{N}  {d.get(\"channel\", \"N/A\")}')
print(f'  {W}{labels[\"duration\"]}{N}    {dur_str}')
print(f'  {W}{labels[\"uploaded\"]}{N}      {upload}')
vc = d.get('view_count')
lc = d.get('like_count')
print(f'  {W}{labels[\"views\"]}{N}    {vc:,}' if vc is not None else f'  {W}{labels[\"views\"]}{N}    N/A')
print(f'  {W}{labels[\"likes\"]}{N}      {lc:,}' if lc is not None else f'  {W}{labels[\"likes\"]}{N}      N/A')
print()
print(f'  {W}{labels[\"formats\"]}{N}')
fmts = d.get('formats', [])
seen = set()
for f in fmts:
    h = f.get('height')
    if h and h not in seen:
        seen.add(h)
for h in sorted(seen, reverse=True):
    print(f'    {G}{h}p{N}')
print()
print(f'  {W}URL:{N} {d.get(\"webpage_url\", \"N/A\")}')
"
  echo ""
  exit 0
fi

# --- Build yt-dlp args ---
YT_ARGS=(--ignore-config --newline --progress)

# Cookies
if [[ "$NO_COOKIE" == false ]]; then
  YT_ARGS+=(--cookies-from-browser "$BROWSER")
fi

# Format
if [[ "$AUDIO_ONLY" == true ]]; then
  YT_ARGS+=(-f "bestaudio[ext=m4a]/bestaudio" -x --audio-format m4a)
elif [[ -n "$QUALITY" ]]; then
  YT_ARGS+=(-f "bestvideo[height<=${QUALITY}]+bestaudio/best[height<=${QUALITY}]")
else
  YT_ARGS+=(-f "bestvideo+bestaudio/best")
fi

# Merge format
if [[ "$AUDIO_ONLY" == false ]]; then
  YT_ARGS+=(--merge-output-format mp4)
fi

# Thumbnail, subtitles, description
YT_ARGS+=(--write-thumbnail --convert-thumbnails jpg)
# Subtitle languages: use -s value, or default based on LANG_CODE
if [[ -n "$SUB_LANGS" ]]; then
  YT_ARGS+=(--write-subs --write-auto-subs --sub-langs "$SUB_LANGS")
else
  case "$LANG_CODE" in
    ja)       YT_ARGS+=(--write-subs --write-auto-subs --sub-langs "ja,ja-orig") ;;
    zh-Hans)  YT_ARGS+=(--write-subs --write-auto-subs --sub-langs "zh-Hans,zh-Hant,zh") ;;
    pt)       YT_ARGS+=(--write-subs --write-auto-subs --sub-langs "pt,pt-BR") ;;
    *)        YT_ARGS+=(--write-subs --write-auto-subs --sub-langs "$LANG_CODE") ;;
  esac
fi
YT_ARGS+=(--write-description)

# Output template
# channel → uploader → webpage_url_domain の順にフォールバック
# YouTube以外のサイトではchannelが空になるため、ドメイン名をディレクトリに使用
CHANNEL_FIELD="%(channel,uploader,webpage_url_domain|unknown)s"
if [[ "$PLAYLIST_MODE" == true ]]; then
  YT_ARGS+=(--yes-playlist)
  OUTPUT_TEMPLATE="${BASE_DIR}/${CHANNEL_FIELD}/%(playlist_title)s/%(playlist_index)03d_%(title)s/%(playlist_index)03d_%(title)s.%(ext)s"
else
  YT_ARGS+=(--no-playlist)
  OUTPUT_TEMPLATE="${BASE_DIR}/${CHANNEL_FIELD}/%(title)s/%(title)s.%(ext)s"
fi
YT_ARGS+=(-o "$OUTPUT_TEMPLATE")

# Extra args
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  YT_ARGS+=("${EXTRA_ARGS[@]}")
fi

# --- Mode string ---
MODE="video"
if [[ "$AUDIO_ONLY" == true ]]; then
  MODE="audio"
fi

# --- Pre-execution summary ---
echo ""
echo "${LINE}"
echo "${C}  ${L_TITLE}${N}  ${D}${L_STARTING}${N}"
echo "${LINE}"
echo ""
echo "  ${W}${L_URL}${N}        ${URL}"
if [[ "$AUDIO_ONLY" == true ]]; then
  echo "  ${W}${L_MODE}${N}      ${Y}${L_MODE_AUDIO}${N}"
elif [[ -n "$QUALITY" ]]; then
  echo "  ${W}${L_QUALITY}${N}        ${G}${QUALITY}p${N}"
else
  echo "  ${W}${L_QUALITY}${N}        ${G}${L_QUALITY_BEST}${N}"
fi
echo "  ${W}${L_SAVETO}${N}      ${BASE_DIR}/"
if [[ "$PLAYLIST_MODE" == true ]]; then
  echo "  ${W}${L_PLAYLIST}${N} ${G}ON${N}"
fi
if [[ "$NO_COOKIE" == true ]]; then
  echo "  ${W}${L_COOKIE}${N}    ${Y}${L_COOKIE_NONE}${N}"
else
  echo "  ${W}${L_COOKIE}${N}    ${BROWSER}"
fi
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  echo "  ${W}${L_EXTRA}${N}    ${EXTRA_ARGS[*]}"
fi
echo ""
echo "${LINE}"
echo ""

# --- Setup log and tracking ---
init_warning_tracker
init_error_tracker
setup_log

# --- Signal handling for cancel ---
DOWNLOAD_DIR=""

cleanup_on_cancel() {
  echo ""
  echo ""
  echo "${Y}⚠ ${L_CANCEL} detected${N}"

  if [[ -n "$DOWNLOAD_DIR" && -d "$DOWNLOAD_DIR" ]]; then
    echo ""
    echo "${LINE}"
    echo "${Y}  ${L_DELETE_ASK}${N}"
    echo "${D}  ${L_DELETE_WARN}${N}"
    echo "${LINE}"
    echo ""
    echo "  1) ${G}${L_DELETE_YES}${N}"
    echo "  2) ${R}${L_DELETE_NO}${N}"
    echo ""

    read -p "Select [2]: " -n 1 -r
    echo

    if [[ "$REPLY" == "1" ]]; then
      rm -rf "$DOWNLOAD_DIR"
      echo "${G}✓ Files deleted${N}"
    else
      echo "${Y}✓ Files kept at: ${DOWNLOAD_DIR}${N}"
    fi
  fi

  close_log
  cleanup_warning_tracker
  cleanup_error_tracker

  if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
    echo "${C}  ${L_LOG_SAVED} ${LOG_FILE}${N}"
  fi

  exit 130
}

trap cleanup_on_cancel INT TERM

# --- Execute yt-dlp with progress parsing ---
echo "${C}  ${L_DOWNLOADING_TO}${N} ${BASE_DIR}/"
echo ""

init_progress "Starting..."
draw_progress
echo ""

# Run yt-dlp and parse output
yt-dlp "${YT_ARGS[@]}" "$URL" 2>&1 | parse_yt_dlp_output
EXIT_CODE=${PIPESTATUS[0]}

echo ""

# --- Detect download directory (find most recently modified media file) ---
DOWNLOAD_DIR=""
MEDIA_FILE=""
_find_media() {
  find "$1" -maxdepth 4 -type f \( -name "*.mp4" -o -name "*.webm" -o -name "*.mkv" -o -name "*.m4a" -o -name "*.mp3" -o -name "*.ts" \) -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null | head -1 || true
}
MEDIA_FILE=$(_find_media "$BASE_DIR")
if [[ -n "$MEDIA_FILE" ]]; then
  DOWNLOAD_DIR=$(dirname "$MEDIA_FILE")
fi

# --- Rename .description → .description.txt ---
if [[ -n "$DOWNLOAD_DIR" && -d "$DOWNLOAD_DIR" ]]; then
  find "$DOWNLOAD_DIR" -name "*.description" -type f 2>/dev/null | while IFS= read -r desc_file; do
    mv "$desc_file" "${desc_file}.txt"
  done
fi

# --- Move log to download directory ---
if [[ -n "$DOWNLOAD_DIR" && -d "$DOWNLOAD_DIR" && -f "$LOG_FILE" ]]; then
  NEW_LOG_FILE="${DOWNLOAD_DIR}/$(basename "$LOG_FILE")"
  mv "$LOG_FILE" "$NEW_LOG_FILE"
  LOG_FILE="$NEW_LOG_FILE"
fi

# --- Show results ---
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "${LINE}"
  echo "${G}  ✓ ${L_DONE}${N}"
  echo "${LINE}"
  echo ""

  if [[ $WARNING_COUNT -gt 0 ]]; then
    echo "${Y}  ⚠ ${WARNING_COUNT} warnings${N}"
    if [[ $SKIPPED_WARNING_COUNT -gt 0 ]]; then
      echo "${D}    ${L_WARNINGS_SKIPPED} (${SKIPPED_WARNING_COUNT})${N}"
    fi
    echo ""
  fi

  # --- Transcribe hook ---
  if [[ "$TRANSCRIBE" == "true" ]]; then
    echo "${W}  ${L_TRANSCRIBE_STARTING}${N}"
    if [[ -n "$MEDIA_FILE" && -f "$MEDIA_FILE" ]]; then
      SCRIPT_DIR_ABS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      MS_ARG=""
      [[ -n "$TRANSCRIBE_MANUSCRIPT" ]] && MS_ARG="manuscript: process.env.YTDL_MANUSCRIPT,"
      # ファイルパスの特殊文字を安全に渡すため環境変数を使用
      YTDL_MEDIA_FILE="$MEDIA_FILE" \
      YTDL_MANUSCRIPT="${TRANSCRIBE_MANUSCRIPT}" \
      node --input-type=module -e "
        import { transcribe } from '${SCRIPT_DIR_ABS}/../lib/transcribe.js';
        transcribe(process.env.YTDL_MEDIA_FILE, {
          backend: '${TRANSCRIBE_BACKEND}',
          language: '${LANG_CODE}',
          ${MS_ARG}
        }).then(() => console.log('${G}  ${L_TRANSCRIBE_DONE}${N}'))
          .catch(e => console.error('${R}  ${L_TRANSCRIBE_FAILED}${N}', e.message));
      " || true
    else
      echo "${Y}  ⚠ Media file not found for transcription${N}"
    fi
    echo ""
  fi
else
  echo "${LINE}"
  echo "${R}  ✗ ${L_ERR_DOWNLOAD} ${EXIT_CODE}${L_ERR_DOWNLOAD_CLOSE}${N}"
  echo "${LINE}"
  echo ""

  # Show error summary from file
  if [[ -f "$ERROR_LOG_FILE" ]]; then
    echo "${R}  ${L_ERRORS_SUMMARY}${N}"
    echo ""
    while IFS= read -r line; do
      err_code="${line%%\]*}"
      err_code="${err_code#\[}"
      err_msg="${line#*\] }"

      echo "  ${R}[${err_code}]${N} ${err_msg}"
      echo "    ${C}${L_ERROR_EXPLANATION}${N} $(get_error_explanation "$err_msg")"
      echo "    ${G}${L_ERROR_SUGGESTION}${N} $(get_error_suggestion "$err_msg")"
      echo ""
    done < "$ERROR_LOG_FILE"
  fi

  # AI-friendly error output
  echo "${W}${L_ERROR_HELP}${N}"
  echo "${C}${L_ERROR_CODE}:${N} ${EXIT_CODE}"
  if [[ -n "$DOWNLOAD_DIR" ]]; then
    echo "${C}${L_VIDEO_DIR}:${N} ${DOWNLOAD_DIR}"
  fi
  echo ""
fi

# --- Save log ---
close_log
cleanup_warning_tracker
cleanup_error_tracker

echo "${C}  ${L_LOG_SAVED} ${LOG_FILE}${N}"
echo ""

exit $EXIT_CODE
