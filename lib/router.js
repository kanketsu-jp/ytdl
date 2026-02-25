/**
 * URLルーター。URLのプロトコルやパターンからバックエンドを判定する。
 *
 * - magnet:              → torrent
 * - .torrent URL         → torrent
 * - rtmp://, rtsp://     → stream
 * - http/https           → ytdlp（デフォルト、失敗時は analyzer へフォールバック）
 */

/**
 * @typedef {{ backend: 'ytdlp'|'torrent'|'stream'|'analyzer', reason: string }} RouteResult
 */

/**
 * URL を解析してバックエンドを判定する。
 * @param {string} url
 * @returns {RouteResult}
 */
export function routeUrl(url) {
  // magnet リンク
  if (url.startsWith('magnet:')) {
    return { backend: 'torrent', reason: 'magnet URI' }
  }

  // .torrent ファイルの URL
  if (/\.torrent(\?.*)?$/.test(url)) {
    return { backend: 'torrent', reason: '.torrent URL' }
  }

  let protocol
  try {
    protocol = new URL(url).protocol
  } catch {
    // URL パース失敗時は ytdlp にフォールバック
    return { backend: 'ytdlp', reason: 'unknown URL format, defaulting to ytdlp' }
  }

  // RTMP / RTSP ストリーム
  if (['rtmp:', 'rtsp:'].includes(protocol)) {
    return { backend: 'stream', reason: `${protocol} stream` }
  }

  // http / https → デフォルトは ytdlp
  if (['http:', 'https:'].includes(protocol)) {
    return { backend: 'ytdlp', reason: 'http/https URL' }
  }

  // その他の未知プロトコル → ytdlp にフォールバック
  return { backend: 'ytdlp', reason: `unknown protocol: ${protocol}` }
}
