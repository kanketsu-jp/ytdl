import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { checkDeps } from '../check-deps.js'
import { currentLang } from '../i18n.js'
import { Backend } from './base.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, '..', '..', 'bin', 'ytdl.sh')

export class YtdlpBackend extends Backend {
  name = 'ytdlp'

  /**
   * http/https URL を処理できる。
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    try {
      const u = new URL(url)
      return ['http:', 'https:'].includes(u.protocol)
    } catch {
      return false
    }
  }

  /**
   * yt-dlp / ffmpeg の存在をチェックする。
   * @returns {Promise<boolean>}
   */
  async checkDeps() {
    await checkDeps()
    return true
  }

  /**
   * メディア情報を取得する（ytdl -i URL）。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<{code: number}>}
   */
  async getInfo(url, opts = {}) {
    return new Promise((resolve) => {
      const child = spawn('bash', [SCRIPT, '--lang', currentLang, '-n', '-i', url], {
        stdio: 'inherit',
      })
      child.on('close', (code) => resolve({ code: code ?? 1 }))
    })
  }

  /**
   * yt-dlp でダウンロードを実行する。
   * args は bin/ytdl.sh に渡す引数配列（URLを含む）。
   * @param {string} url
   * @param {object} opts
   * @param {string[]} opts.args - ytdl.sh に渡す引数（URLを含む）
   * @returns {Promise<{code: number, stderr: string}>}
   */
  async download(url, opts = {}) {
    const args = opts.args ?? [url]
    return runScript(args)
  }
}

/**
 * bin/ytdl.sh を実行し stderr を回収して返す。
 * @param {string[]} args
 * @returns {Promise<{code: number, stderr: string}>}
 */
export function runScript(args) {
  return new Promise((resolve) => {
    const chunks = []
    const child = spawn('bash', [SCRIPT, '--lang', currentLang, ...args], {
      stdio: ['inherit', 'inherit', 'pipe'],
    })
    child.stderr.on('data', (d) => chunks.push(d))
    child.on('close', (code) => {
      resolve({ code: code ?? 0, stderr: Buffer.concat(chunks).toString() })
    })
  })
}
