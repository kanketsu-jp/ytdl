/**
 * ストリームバックエンド。
 * RTMP / RTSP / RTP などのライブストリームを ffmpeg で録画する。
 * fluent-ffmpeg には依存せず child_process.spawn を直接使用する。
 */

import { spawn, execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { Backend } from './base.js'
import { t } from '../i18n.js'

/**
 * コマンドの存在確認。
 * @param {string} cmd
 * @returns {boolean}
 */
function exists(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * ストリーム URL からファイル名を生成する。
 * 例: rtmp://live.example.com/app/stream → live.example.com_20240101T120000.mp4
 * @param {string} url
 * @returns {string}
 */
function buildOutputPath(url) {
  let hostname = 'stream'
  try {
    hostname = new URL(url).hostname || 'stream'
  } catch {
    // パース失敗時はデフォルト値を使用
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
  const filename = `${hostname}_${ts}.mp4`
  return path.join(os.homedir(), 'Downloads', filename)
}

/**
 * ffmpeg stderr から録画時間を解析する。
 * 例: "time=00:01:23.45" → "00:01:23"
 * @param {string} line
 * @returns {string | null}
 */
function parseTime(line) {
  const m = line.match(/time=(\d{2}:\d{2}:\d{2})/)
  return m ? m[1] : null
}

export class StreamBackend extends Backend {
  name = 'stream'

  /**
   * rtmp://, rtsp://, rtp:// プロトコルを処理できる。
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    return /^(rtmp|rtsp|rtp):\/\//i.test(url)
  }

  /**
   * ffmpeg がインストール済みか判定する。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return exists('ffmpeg')
  }

  /**
   * ffmpeg / ffprobe の存在をチェックする。
   * @returns {Promise<boolean>}
   */
  async checkDeps() {
    const missing = []
    if (!exists('ffmpeg')) missing.push('ffmpeg')
    if (!exists('ffprobe')) missing.push('ffprobe')

    if (missing.length > 0) {
      const { default: pc } = await import('picocolors')
      console.error('')
      console.error(pc.red(t.missingDeps))
      for (const cmd of missing) {
        console.error(`  ${pc.bold(cmd)}`)
        console.error(`  ${pc.cyan(`brew install ffmpeg`)}`)
      }
      console.error('')
      return false
    }
    return true
  }

  /**
   * ffprobe でストリーム情報を取得する。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<{code: number}>}
   */
  async getInfo(url, opts = {}) {
    const { default: pc } = await import('picocolors')
    return new Promise((resolve) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        url,
      ]
      const child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'inherit'] })
      const chunks = []
      child.stdout.on('data', (d) => chunks.push(d))
      child.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(Buffer.concat(chunks).toString())
            console.log('')
            // ストリーム情報を表示
            if (info.streams) {
              for (const s of info.streams) {
                if (s.codec_type === 'video') {
                  console.log(`  video: ${s.codec_name} ${s.width}x${s.height}`)
                } else if (s.codec_type === 'audio') {
                  console.log(`  audio: ${s.codec_name} ${s.sample_rate}Hz`)
                }
              }
            }
            if (info.format) {
              console.log(`  format: ${info.format.format_long_name || info.format.format_name}`)
            }
            console.log('')
          } catch {
            // JSON パース失敗はそのまま終了
          }
        }
        resolve({ code: code ?? 1 })
      })
    })
  }

  /**
   * ffmpeg でストリームを録画する。
   * - デフォルト: -c copy（トランスコードなし）
   * - opts.duration: 録画時間（秒）
   * - opts.outputPath: 出力先ファイルパス（省略時は ~/Downloads/{hostname}_{timestamp}.mp4）
   * @param {string} url
   * @param {object} opts
   * @param {number} [opts.duration] - 録画時間（秒）
   * @param {string} [opts.outputPath] - 出力先ファイルパス
   * @returns {Promise<{code: number, stderr: string}>}
   */
  async download(url, opts = {}) {
    const { default: pc } = await import('picocolors')
    const outputPath = opts.outputPath || buildOutputPath(url)

    const args = [
      '-i', url,
      '-c', 'copy',
    ]

    // 録画時間制限
    if (opts.duration) {
      args.push('-t', String(opts.duration))
    }

    // 既存ファイルを上書きしない（プロンプトが出ないよう -n を指定）
    args.push('-n', outputPath)

    console.log('')
    console.log(pc.cyan(t.streamRecording))
    if (opts.duration) {
      console.log(pc.dim(`  ${t.streamDuration}: ${opts.duration}s`))
    }
    console.log(pc.dim(`  → ${outputPath}`))
    console.log('')

    return new Promise((resolve) => {
      const child = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      })

      const chunks = []
      let lastTime = null

      // ffmpeg の stderr をパースしてプログレスを表示
      child.stderr.on('data', (data) => {
        const line = data.toString()
        chunks.push(Buffer.from(line))

        const time = parseTime(line)
        if (time && time !== lastTime) {
          lastTime = time
          process.stderr.write(`\r  ${pc.dim('recording:')} ${pc.green(time)}    `)
        }
      })

      // Ctrl+C でグレースフルに停止
      const onSigint = () => {
        process.stderr.write('\n')
        console.log(pc.yellow('  録画を停止しています...'))
        child.kill('SIGINT')
      }
      process.once('SIGINT', onSigint)

      child.on('close', (code) => {
        process.removeListener('SIGINT', onSigint)
        process.stderr.write('\n')
        resolve({
          code: code ?? 0,
          stderr: Buffer.concat(chunks).toString(),
        })
      })
    })
  }
}
