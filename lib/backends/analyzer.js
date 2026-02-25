/**
 * サイト解析バックエンド。
 * Chrome ヘッドレス + CDP (Chrome DevTools Protocol) でページを解析し、
 * 埋め込みメディア URL を検出して適切なバックエンドに委譲する。
 * 依存: ws (WebSocket クライアント) + ユーザーの Chrome
 * Puppeteer 不要 — Chrome を直接制御する軽量アプローチ。
 */

import { spawn as cpSpawn, execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, readFileSync, promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Backend } from './base.js'
import { t } from '../i18n.js'
import { isBackendDepAvailable, checkBackendDep } from '../check-deps.js'

/**
 * DRM ライセンスリクエストの URL パターン。
 */
const DRM_PATTERNS = [
  /widevine/i,
  /playready/i,
  /fairplay/i,
  /clearkey/i,
  /license\.irdeto/i,
  /license\.axprod/i,
  /\.licenseserver\./i,
]

/**
 * メディアファイルの URL パターン。
 */
const MEDIA_PATTERNS = [
  /\.m3u8(\?|$)/i,   // HLS
  /\.mpd(\?|$)/i,    // DASH
  /\.mp4(\?|$)/i,
  /\.webm(\?|$)/i,
  /\.ts(\?|$)/i,     // MPEG-TS セグメント
  /\.m4s(\?|$)/i,    // DASH セグメント
]

/**
 * RTMP/RTSP の URL パターン。
 */
const STREAM_PROTOCOLS = /^(rtmp|rtsp|rtp):\/\//i

/**
 * 検出されたメディア URL が無料/プレビュー版の可能性があるか判定する。
 * URL に public, free, preview, sample, trailer, guest 等のキーワードが含まれる場合 true。
 * @param {string[]} urls
 * @returns {boolean}
 */
function _looksLikeFreeContent(urls) {
  const freePatterns = /\b(public|free|preview|sample|trailer|guest|demo|trial)\b/i
  return urls.some((u) => freePatterns.test(u))
}

// ────────────────────────────────────────────────────
// Chrome 検出・プロファイル・起動ヘルパー
// ────────────────────────────────────────────────────

/**
 * ローカルにインストールされた Chrome の実行パスを検出する。
 * @returns {string | null}
 */
function findChrome() {
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
  }

  if (process.platform === 'linux') {
    for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
      try {
        const p = execFileSync('which', [cmd], { encoding: 'utf8' }).trim()
        if (p) return p
      } catch { /* not found */ }
    }
  }

  return null
}

/**
 * Chrome のユーザーデータディレクトリのパスを返す。
 * @returns {string | null}
 */
function getChromeUserDataDir() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
  }
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config', 'google-chrome')
  }
  return null
}

/**
 * ytdl 設定ディレクトリのパスを返す。
 * @returns {string}
 */
function getYtdlDir() {
  return path.join(os.homedir(), '.ytdl')
}

/**
 * ytdl 専用の永続 Chrome プロファイルディレクトリを返す。
 * @returns {string}
 */
function getYtdlProfileDir() {
  return path.join(getYtdlDir(), 'chrome-profile')
}

/**
 * ytdl 設定ファイルを読み取る。
 * @returns {object}
 */
export function readConfig() {
  const configPath = path.join(getYtdlDir(), 'config.json')
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * ytdl 設定ファイルに書き込む。
 * @param {object} updates - 更新するキーと値
 */
export async function writeConfig(updates) {
  const dir = getYtdlDir()
  await fsp.mkdir(dir, { recursive: true })
  const configPath = path.join(dir, 'config.json')
  const existing = readConfig()
  await fsp.writeFile(configPath, JSON.stringify({ ...existing, ...updates }, null, 2))
}

/**
 * 永続プロファイルの使用が許可されているか確認する。
 * 初回は TTY でユーザーに同意を求め、結果を config.json に保存する。
 * @returns {Promise<boolean>}
 */
async function isPersistentProfileAllowed() {
  const config = readConfig()
  if (config.persistentProfile === true) return true
  if (config.persistentProfile === false) return false

  // 初回: ユーザーに確認
  if (!process.stdin.isTTY) return false

  const p = await import('@clack/prompts')
  const { default: pc } = await import('picocolors')

  console.log('')
  console.log(pc.cyan(t.analyzerProfileExplain))
  console.log(pc.dim(t.analyzerProfilePath.replace('{0}', getYtdlProfileDir())))
  console.log('')

  const allow = await p.confirm({
    message: t.analyzerProfileConfirm,
    initialValue: true,
  })

  if (p.isCancel(allow)) return false

  await writeConfig({ persistentProfile: !!allow })
  return !!allow
}

/**
 * 解析に使うプロファイルディレクトリを取得する。
 * 永続プロファイルが許可されていれば永続、そうでなければ一時ディレクトリを作成。
 * @param {boolean} persistent - 永続プロファイルを使うか
 * @returns {Promise<{ dir: string, isTemp: boolean }>}
 */
async function getProfileDir(persistent) {
  if (persistent) {
    const profileDir = getYtdlProfileDir()
    const defaultDir = path.join(profileDir, 'Default')

    if (!existsSync(path.join(defaultDir, 'Cookies'))) {
      // 初回: Chrome プロファイルから Cookie をコピー
      await fsp.mkdir(defaultDir, { recursive: true })
      const chromeUserData = getChromeUserDataDir()
      if (chromeUserData) {
        const defaultSrc = path.join(chromeUserData, 'Default')
        const filesToCopy = [
          { src: path.join(chromeUserData, 'Local State'), dest: path.join(profileDir, 'Local State') },
          { src: path.join(defaultSrc, 'Cookies'), dest: path.join(defaultDir, 'Cookies') },
          { src: path.join(defaultSrc, 'Cookies-journal'), dest: path.join(defaultDir, 'Cookies-journal') },
        ]
        for (const { src, dest } of filesToCopy) {
          try { await fsp.copyFile(src, dest) } catch { /* skip */ }
        }
      }
    }

    return { dir: profileDir, isTemp: false }
  }

  // 一時プロファイル
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ytdl-chrome-'))
  const defaultDir = path.join(tempDir, 'Default')
  await fsp.mkdir(defaultDir, { recursive: true })

  const chromeUserData = getChromeUserDataDir()
  if (chromeUserData) {
    const defaultSrc = path.join(chromeUserData, 'Default')
    const filesToCopy = [
      { src: path.join(chromeUserData, 'Local State'), dest: path.join(tempDir, 'Local State') },
      { src: path.join(defaultSrc, 'Cookies'), dest: path.join(defaultDir, 'Cookies') },
      { src: path.join(defaultSrc, 'Cookies-journal'), dest: path.join(defaultDir, 'Cookies-journal') },
    ]
    for (const { src, dest } of filesToCopy) {
      try { await fsp.copyFile(src, dest) } catch { /* skip */ }
    }
  }

  return { dir: tempDir, isTemp: true }
}

/**
 * CDP デバッガーの起動を待機する。
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<number>} port
 */
async function waitForDebugger(port, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      await res.json()
      return port
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error(`Chrome debugger did not start within ${timeoutMs}ms`)
}

/**
 * 既存のページタブの WebSocket URL を取得する。
 * Chrome 起動時の about:blank タブを再利用する。
 * @param {number} port
 * @returns {Promise<string>} ページの WebSocket debugger URL
 */
async function getPageTarget(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`)
  const targets = await res.json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('No page target found')
  return page.webSocketDebuggerUrl
}

/**
 * Chrome を起動して CDP 接続情報を返す。
 * @param {string} tempDir - ユーザーデータディレクトリ
 * @param {object} options
 * @param {boolean} [options.headless=true] - ヘッドレスモードで起動するか
 * @param {string} [options.url='about:blank'] - 起動時に開く URL
 * @returns {Promise<{child: import('node:child_process').ChildProcess, port: number}>}
 */
async function launchChrome(tempDir, { headless = true, url = 'about:blank' } = {}) {
  const chromePath = findChrome()
  if (!chromePath) throw new Error('Chrome not found')

  // 前回クラッシュ時の残留ロックファイルを除去
  const lockPath = path.join(tempDir, 'SingletonLock')
  try { await fsp.unlink(lockPath) } catch { /* not found — ok */ }

  const port = 9222 + Math.floor(Math.random() * 1000)

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--disable-sync',
    '--disable-translate',
    '--mute-audio',
  ]

  if (headless) {
    args.push('--headless=new', '--no-sandbox', '--disable-gpu')
  }

  args.push(url)

  const child = cpSpawn(chromePath, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: false,
  })

  await waitForDebugger(port)
  return { child, port }
}

// ────────────────────────────────────────────────────
// 軽量 CDP クライアント
// ────────────────────────────────────────────────────

/**
 * WebSocket 上で CDP コマンドを送受信する最小クライアント。
 */
class CDPSession {
  constructor(ws) {
    this._ws = ws
    this._id = 0
    this._callbacks = new Map()
    this._listeners = new Map()

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw)
      if (msg.id !== undefined) {
        const cb = this._callbacks.get(msg.id)
        if (cb) {
          this._callbacks.delete(msg.id)
          if (msg.error) cb.reject(new Error(msg.error.message))
          else cb.resolve(msg.result)
        }
      } else if (msg.method) {
        const handlers = this._listeners.get(msg.method) || []
        for (const h of handlers) h(msg.params)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this._id
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject })
      this._ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, handler) {
    if (!this._listeners.has(method)) this._listeners.set(method, [])
    this._listeners.get(method).push(handler)
  }

  close() {
    this._ws.close()
  }
}

// ────────────────────────────────────────────────────
// 共通 CDP ヘルパー
// ────────────────────────────────────────────────────

/**
 * ネットワーク監視をセットアップする。
 * @param {CDPSession} cdp
 * @returns {{ mediaUrls: Set<string>, hasDrm: { value: boolean } }}
 */
function setupNetworkMonitoring(cdp) {
  const mediaUrls = new Set()
  const hasDrm = { value: false }

  cdp.on('Network.requestWillBeSent', (params) => {
    const reqUrl = params.request.url
    if (DRM_PATTERNS.some((p) => p.test(reqUrl))) {
      hasDrm.value = true
      return
    }
    if (MEDIA_PATTERNS.some((p) => p.test(reqUrl))) {
      mediaUrls.add(reqUrl)
    }
    if (STREAM_PROTOCOLS.test(reqUrl)) {
      mediaUrls.add(reqUrl)
    }
  })

  cdp.on('Network.responseReceived', (params) => {
    const respUrl = params.response.url
    const headers = params.response.headers
    const contentType = headers['content-type'] || headers['Content-Type'] || ''
    if (
      contentType.includes('application/x-mpegurl') ||
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/dash+xml') ||
      contentType.includes('video/') ||
      contentType.includes('audio/')
    ) {
      const length = parseInt(
        headers['content-length'] || headers['Content-Length'] || '0', 10
      )
      if (length > 1000 || length === 0) {
        mediaUrls.add(respUrl)
      }
    }
  })

  return { mediaUrls, hasDrm }
}

/**
 * DOM からメディア URL を抽出する。
 * @param {CDPSession} cdp
 * @returns {Promise<string[]>}
 */
async function extractDomUrls(cdp) {
  const domResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const urls = new Set()
      document.querySelectorAll('video[src], video source[src]').forEach((el) => {
        const src = el.getAttribute('src')
        if (src && src.startsWith('http')) urls.add(src)
      })
      document.querySelectorAll('iframe[src]').forEach((el) => {
        const src = el.getAttribute('src')
        if (src && src.startsWith('http')) urls.add(src)
      })
      const ogVideo = document.querySelector('meta[property="og:video"], meta[property="og:video:url"]')
      if (ogVideo) {
        const content = ogVideo.getAttribute('content')
        if (content && content.startsWith('http')) urls.add(content)
      }
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
        try {
          const data = JSON.parse(el.textContent || '{}')
          const extractUrls = (obj) => {
            if (!obj || typeof obj !== 'object') return
            if (obj['@type'] === 'VideoObject') {
              if (obj.contentUrl) urls.add(obj.contentUrl)
              if (obj.embedUrl) urls.add(obj.embedUrl)
            }
            for (const v of Object.values(obj)) {
              if (typeof v === 'object') extractUrls(v)
            }
          }
          extractUrls(Array.isArray(data) ? data : [data])
        } catch {}
      })
      return JSON.stringify([...urls])
    })()`,
    returnByValue: true,
  })

  if (domResult?.result?.value) {
    return JSON.parse(domResult.result.value)
  }
  return []
}

/**
 * ページのメタデータ（タイトル、og:video、動画の長さ）を抽出する。
 * @param {CDPSession} cdp
 * @returns {Promise<{title: string, ogVideo: string | null, duration: number | null}>}
 */
async function extractMetadata(cdp) {
  const metaResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.title || ''
      const ogEl = document.querySelector('meta[property="og:video"]')
      const ogVideo = ogEl ? ogEl.getAttribute('content') : null
      const video = document.querySelector('video')
      const duration = video && isFinite(video.duration) ? video.duration : null
      return JSON.stringify({ title, ogVideo, duration })
    })()`,
    returnByValue: true,
  })

  if (metaResult?.result?.value) {
    return JSON.parse(metaResult.result.value)
  }
  return { title: '', ogVideo: null, duration: null }
}

/**
 * CDP セッションから Cookie を抽出する。
 * @param {CDPSession} cdp
 * @returns {Promise<Array<{name: string, value: string, domain: string}>>}
 */
async function extractCookies(cdp) {
  const cookieResult = await cdp.send('Network.getAllCookies')
  return (cookieResult?.cookies || []).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
  }))
}

/**
 * ページロード完了を待機する。
 * @param {CDPSession} cdp
 * @param {number} [timeoutMs=30000]
 * @param {number} [extraWaitMs=5000]
 * @returns {Promise<void>}
 */
function waitForPageLoad(cdp, timeoutMs = 30000, extraWaitMs = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    cdp.on('Page.loadEventFired', () => {
      clearTimeout(timer)
      setTimeout(resolve, extraWaitMs)
    })
  })
}

/**
 * stdin から Enter キー入力を待機する。
 * @param {string} message - 表示するメッセージ
 * @returns {Promise<void>}
 */
function waitForEnter(message) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve()
      return
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(message + ' ', () => {
      rl.close()
      resolve()
    })
  })
}

// ────────────────────────────────────────────────────
// AnalyzerBackend
// ────────────────────────────────────────────────────

export class AnalyzerBackend extends Backend {
  name = 'analyzer'

  /**
   * デフォルトでは canHandle は false。
   * --analyze フラグまたは --via analyzer で明示指定された場合のみ使用する。
   */
  canHandle(url) {
    return false
  }

  /**
   * Chrome と ws がインストール済みか判定する。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (!findChrome()) return false
    return isBackendDepAvailable('ws')
  }

  /**
   * Chrome の存在と ws パッケージを確認し、なければインストールを尋ねる。
   * @returns {Promise<boolean>}
   */
  async checkDeps() {
    const chromePath = findChrome()
    if (!chromePath) {
      const { default: pc } = await import('picocolors')
      console.error('')
      console.error(pc.red(t.backendDepMissing.replace('{0}', 'Google Chrome')))
      console.error(pc.dim('  https://www.google.com/chrome/'))
      console.error('')
      return false
    }
    return checkBackendDep('ws')
  }

  /**
   * CDP セッション上でページを解析し、結果を返す共通の内部メソッド。
   * @param {CDPSession} cdp
   * @param {string} url
   * @param {import('picocolors').Colors} pc
   * @returns {Promise<AnalyzeResult>}
   */
  async _collectResults(cdp, url, pc) {
    const { mediaUrls, hasDrm } = setupNetworkMonitoring(cdp)

    await cdp.send('Network.enable')
    await cdp.send('Page.enable')

    const loadPromise = waitForPageLoad(cdp)
    await cdp.send('Page.navigate', { url })
    await loadPromise

    // DOM からメディア URL を抽出
    for (const u of await extractDomUrls(cdp)) {
      mediaUrls.add(u)
    }

    const metadata = await extractMetadata(cdp)
    const cookies = await extractCookies(cdp)

    cdp.close()

    // 検出結果をもとにバックエンドを推薦
    const urlList = [...mediaUrls]
    let suggestedBackend = 'ytdlp'

    if (urlList.some((u) => STREAM_PROTOCOLS.test(u))) {
      suggestedBackend = 'stream'
    } else if (urlList.some((u) => /\.(m3u8|mpd)(\?|$)/i.test(u))) {
      suggestedBackend = 'ytdlp'
    }

    // 結果を表示
    if (urlList.length > 0) {
      console.log(pc.green(t.analyzerFoundMedia.replace('{0}', urlList.length)))
      for (const u of urlList) {
        console.log(pc.dim(`  ${u}`))
      }
    } else {
      console.log(pc.yellow(t.analyzerNoMedia))
    }

    if (hasDrm.value) {
      console.log(pc.red(t.analyzerDrmDetected))
    }

    console.log('')

    return {
      mediaUrls: urlList,
      suggestedBackend,
      hasDrm: hasDrm.value,
      cookies,
      metadata,
    }
  }

  /**
   * Chrome ヘッドレス + CDP でページを解析し、メディア URL を検出する。
   * ログイン済み Chrome プロファイルの Cookie を利用して認証済みアクセスが可能。
   * @param {string} url
   * @returns {Promise<AnalyzeResult>}
   */
  async analyze(url) {
    const { default: pc } = await import('picocolors')
    const { default: WebSocket } = await import('ws')

    console.log('')
    console.log(pc.cyan(t.analyzerScanning))

    const persistent = await isPersistentProfileAllowed()
    const { dir: profileDir, isTemp } = await getProfileDir(persistent)
    let chromeProcess = null

    try {
      const { child, port } = await launchChrome(profileDir)
      chromeProcess = child

      const tabWsUrl = await getPageTarget(port)
      const ws = new WebSocket(tabWsUrl)
      await new Promise((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
      })

      const cdp = new CDPSession(ws)
      return await this._collectResults(cdp, url, pc)
    } finally {
      if (chromeProcess) {
        chromeProcess.kill('SIGTERM')
        setTimeout(() => {
          try { chromeProcess.kill('SIGKILL') } catch { /* already dead */ }
        }, 2000)
      }
      // ロックファイルを除去（次回起動のブロックを防止）
      fsp.unlink(path.join(profileDir, 'SingletonLock')).catch(() => {})
      // 一時プロファイルのみ削除
      if (isTemp) {
        fsp.rm(profileDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  }

  /**
   * Chrome GUI モードでページを開き、ユーザーにログインを促してからメディアを検出する。
   * @param {string} url
   * @returns {Promise<AnalyzeResult>}
   */
  async analyzeWithLogin(url) {
    const { default: pc } = await import('picocolors')
    const { default: WebSocket } = await import('ws')

    // ログイン時は永続プロファイルを優先（ログインを保持するため）
    const persistent = await isPersistentProfileAllowed()
    const { dir: profileDir, isTemp } = await getProfileDir(persistent)
    let chromeProcess = null

    try {
      console.log(pc.cyan(t.analyzerLaunchingBrowser))

      // GUI モードで Chrome を起動
      const { child, port } = await launchChrome(profileDir, { headless: false, url })
      chromeProcess = child

      let chromeClosed = false
      child.on('exit', () => { chromeClosed = true })

      // ユーザーにログインを促す
      await waitForEnter(pc.yellow(t.analyzerLoginPrompt))

      if (chromeClosed) {
        throw new Error('Chrome was closed before login completed')
      }

      // ログイン後、CDP 接続してページ遷移 → メディア検出
      console.log(pc.cyan(t.analyzerReloading))

      const tabWsUrl = await getPageTarget(port)
      const ws = new WebSocket(tabWsUrl)
      await new Promise((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
      })

      const cdp = new CDPSession(ws)

      // navigate で新規ページ遷移（reload ではなく navigate で確実にネットワーク監視）
      const result = await this._collectResults(cdp, url, pc)

      // Chrome を閉じるか確認
      if (process.stdin.isTTY && !chromeClosed) {
        const pMod = await import('@clack/prompts')
        const closeAction = await pMod.confirm({
          message: t.analyzerCloseBrowser,
          initialValue: true,
        })
        if (pMod.isCancel(closeAction) || closeAction) {
          chromeProcess.kill('SIGTERM')
          chromeProcess = null
        } else {
          // Chrome を閉じずにバックグラウンドで残す
          child.unref()
          chromeProcess = null
          console.log(pc.dim(t.analyzerBrowserKept))
        }
      }

      return result
    } finally {
      if (chromeProcess) {
        chromeProcess.kill('SIGTERM')
        setTimeout(() => {
          try { chromeProcess.kill('SIGKILL') } catch { /* already dead */ }
        }, 2000)
      }
      // ロックファイルを除去（次回起動のブロックを防止）
      fsp.unlink(path.join(profileDir, 'SingletonLock')).catch(() => {})
      // 一時プロファイルのみ削除（永続は保持）
      if (isTemp) {
        fsp.rm(profileDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  }

  /**
   * analyze() を呼んで結果を表示する。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<{code: number}>}
   */
  async getInfo(url, opts = {}) {
    try {
      await this.analyze(url)
      return { code: 0 }
    } catch (err) {
      console.error(err.message)
      return { code: 1 }
    }
  }

  /**
   * analyze() を実行し、検出したメディア URL を suggestedBackend に委譲する。
   * TTY では検出結果をユーザーに表示して確認・ログインフォールバックを提案する。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<{code: number, stderr: string}>}
   */
  async download(url, opts = {}) {
    const { default: pc } = await import('picocolors')

    let result
    try {
      result = await this.analyze(url)
    } catch (err) {
      console.error(pc.red(err.message))
      return { code: 1, stderr: err.message }
    }

    // TTY の場合: 検出結果をユーザーに見せて確認させる
    if (process.stdin.isTTY && result.mediaUrls.length > 0) {
      const p = await import('@clack/prompts')
      const isFree = _looksLikeFreeContent(result.mediaUrls)

      // 検出結果のサマリーを表示
      const summaryLines = []
      if (result.metadata.title) {
        summaryLines.push(`${pc.dim(t.analyzerMetaTitle)}  ${result.metadata.title}`)
      }
      if (result.metadata.duration) {
        const min = Math.floor(result.metadata.duration / 60)
        const sec = Math.floor(result.metadata.duration % 60)
        summaryLines.push(`${pc.dim(t.analyzerMetaDuration)}  ${min}:${String(sec).padStart(2, '0')}`)
      }
      summaryLines.push(`${pc.dim(t.analyzerMetaMedia)}  ${result.mediaUrls.length} URL(s)`)
      if (isFree) {
        summaryLines.push(pc.yellow(t.analyzerFreeContentDetected))
      }
      if (result.hasDrm) {
        summaryLines.push(pc.red(t.analyzerDrmDetected))
      }

      p.note(summaryLines.join('\n'), t.analyzerResultTitle)

      const action = await p.select({
        message: t.analyzerConfirmAction,
        options: [
          { value: 'download', label: t.analyzerActionDownload },
          { value: 'login', label: t.analyzerActionLogin, hint: t.analyzerActionLoginHint },
          { value: 'abort', label: t.abort },
        ],
      })

      if (p.isCancel(action) || action === 'abort') {
        return { code: 0, stderr: '' }
      }

      if (action === 'login') {
        try {
          result = await this.analyzeWithLogin(url)
        } catch (err) {
          console.error(pc.red(err.message))
          return { code: 1, stderr: err.message }
        }
        if (result.mediaUrls.length === 0) {
          console.error(pc.yellow(t.analyzerNoMedia))
          return { code: 1, stderr: 'no media found after login' }
        }
      }
    }

    // メディアなし + TTY の場合: ログインを提案
    if (result.mediaUrls.length === 0 && process.stdin.isTTY) {
      const p = await import('@clack/prompts')
      console.log(pc.yellow(t.analyzerNoMedia))

      const tryLogin = await p.confirm({
        message: t.analyzerTryLogin,
        initialValue: true,
      })

      if (!p.isCancel(tryLogin) && tryLogin) {
        try {
          result = await this.analyzeWithLogin(url)
        } catch (err) {
          console.error(pc.red(err.message))
          return { code: 1, stderr: err.message }
        }
      }
    }

    if (result.mediaUrls.length === 0) {
      console.error(pc.yellow(t.analyzerNoMedia))
      return { code: 1, stderr: 'no media found' }
    }

    // 検出した最初のメディア URL を使用
    const targetUrl = result.mediaUrls[0]
    const { getBackendByName } = await import('./index.js')

    const backend = getBackendByName(result.suggestedBackend) || getBackendByName('ytdlp')
    if (!backend) {
      return { code: 1, stderr: 'no backend available' }
    }

    // 元ページのメタデータを yt-dlp に渡すための引数を構築
    const downloadOpts = { ...opts }
    if (result.suggestedBackend === 'ytdlp') {
      const ytdlpPassthrough = []
      let domain
      try {
        const parsed = new URL(url)
        domain = parsed.hostname.replace(/^www\./, '')
      } catch { /* ignore */ }
      if (domain) {
        ytdlpPassthrough.push('--parse-metadata', `${domain}:%(channel)s`)
      }

      const title = result.metadata.title || ''
      if (title) {
        ytdlpPassthrough.push('--parse-metadata', `${title}:%(title)s`)
      }

      // 既存ファイルの検出（同タイトルで既にダウンロード済みの場合）
      let outputSuffix = ''
      if (domain && title) {
        const { existsSync: exists, readdirSync: readdir } = await import('node:fs')
        const pathMod = await import('node:path')
        const osMod = await import('node:os')

        // 出力テンプレート: {base}/{channel}/{title}/{title}.ext
        const oIdx = (opts.args || []).indexOf('-o')
        const baseDir = oIdx !== -1 && (opts.args || [])[oIdx + 1]
          ? (opts.args || [])[oIdx + 1]
          : pathMod.default.join(osMod.default.homedir(), 'Downloads')
        // sanitize title (yt-dlp replaces some chars)
        const safeTitle = title.replace(/[/\\|]/g, '｜').replace(/[<>:"/\\|?*]/g, '_')
        const existingDir = pathMod.default.join(baseDir, domain, safeTitle)

        if (exists(existingDir)) {
          const hasMedia = (() => {
            try {
              return readdir(existingDir).some((f) =>
                /\.(mp4|webm|mkv|m4a|mp3)$/i.test(f)
              )
            } catch { return false }
          })()

          if (hasMedia && process.stdin.isTTY) {
            const pMod = await import('@clack/prompts')
            console.log(pc.yellow(t.analyzerExistingFile.replace('{0}', existingDir)))

            const overwriteAction = await pMod.select({
              message: t.analyzerOverwriteAction,
              options: [
                { value: 'overwrite', label: t.analyzerOverwrite },
                { value: 'rename', label: t.analyzerRename },
                { value: 'abort', label: t.abort },
              ],
            })

            if (pMod.isCancel(overwriteAction) || overwriteAction === 'abort') {
              return { code: 0, stderr: '' }
            }

            if (overwriteAction === 'rename') {
              // _2, _3, ... のサフィックスを自動決定
              let n = 2
              while (exists(pathMod.default.join(baseDir, domain, `${safeTitle}_${n}`))) n++
              outputSuffix = `_${n}`
            }
          }
        }
      }

      // サフィックスがある場合、タイトルに追加
      if (outputSuffix && title) {
        // 元のタイトル metadata を上書き
        ytdlpPassthrough.pop() // 直前の --parse-metadata title を除去
        ytdlpPassthrough.pop()
        ytdlpPassthrough.push('--parse-metadata', `${title}${outputSuffix}:%(title)s`)
      }

      // 上書きモード（サフィックスなし = 上書き確定）
      if (!outputSuffix) {
        ytdlpPassthrough.push('--force-overwrites')
      }

      const baseArgs = (opts.args || []).filter((a) => a !== url)
      downloadOpts.args = [targetUrl, ...baseArgs, '--', ...ytdlpPassthrough]
    }

    return backend.download(targetUrl, downloadOpts)
  }
}
