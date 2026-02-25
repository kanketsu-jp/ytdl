/**
 * ダウンロード完了後に保存先ディレクトリを開くユーティリティ。
 *
 * 動作:
 *   YTDL_OPEN_DIR=true  → 確認なしで自動的に開く
 *   YTDL_OPEN_DIR=false → 確認なしでスキップ
 *   未設定              → TTY ならユーザーに確認、非 TTY ならスキップ
 *
 * プラットフォーム自動判定:
 *   macOS   → open
 *   Linux   → xdg-open
 *   Windows → explorer
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * OS に応じたディレクトリオープンコマンドを返す。
 * @returns {{ cmd: string, args: string[] } | null}
 */
function getOpenCommand() {
  switch (process.platform) {
    case 'darwin':
      return { cmd: 'open', args: [] }
    case 'linux':
      return { cmd: 'xdg-open', args: [] }
    case 'win32':
      return { cmd: 'explorer', args: [] }
    default:
      return null
  }
}

/**
 * 指定ディレクトリをファイルマネージャーで開く。
 * @param {string} dirPath - 開くディレクトリパス
 * @returns {Promise<boolean>} 成功したら true
 */
function openDirectory(dirPath) {
  return new Promise((resolve) => {
    const opener = getOpenCommand()
    if (!opener) {
      resolve(false)
      return
    }

    if (!existsSync(dirPath)) {
      resolve(false)
      return
    }

    const child = spawn(opener.cmd, [...opener.args, dirPath], {
      stdio: 'ignore',
      detached: true,
    })
    child.unref()
    child.on('error', () => resolve(false))
    setTimeout(() => resolve(true), 300)
  })
}

/**
 * ~ をホームディレクトリに展開する。
 * @param {string} p
 * @returns {string}
 */
function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
}

/**
 * ベースディレクトリ内で最近更新されたメディアファイルを含むディレクトリを探す。
 * ytdl の出力テンプレート: {base}/{channel}/{title}/{title}.ext
 * → 最も深い階層のディレクトリ（ファイルの親）を返す。
 * @param {string} baseDir - ベースディレクトリ（~/Downloads 等）
 * @returns {string | null}
 */
function findLatestDownloadDir(baseDir) {
  const resolved = expandHome(baseDir)
  if (!existsSync(resolved)) return null

  const mediaExts = new Set(['.mp4', '.webm', '.mkv', '.m4a', '.mp3', '.ts'])
  let latestDir = null
  let latestTime = 0

  // {base}/{channel}/ を走査
  try {
    const channels = readdirSync(resolved)
    for (const ch of channels) {
      const chPath = path.join(resolved, ch)
      try {
        if (!statSync(chPath).isDirectory()) continue
      } catch { continue }

      // {base}/{channel}/{title}/ を走査
      const titles = readdirSync(chPath)
      for (const ti of titles) {
        const tiPath = path.join(chPath, ti)
        try {
          if (!statSync(tiPath).isDirectory()) continue
        } catch { continue }

        // ディレクトリ内にメディアファイルがあるか確認
        try {
          const files = readdirSync(tiPath)
          for (const f of files) {
            const ext = path.extname(f).toLowerCase()
            if (mediaExts.has(ext)) {
              const fPath = path.join(tiPath, f)
              try {
                const mtime = statSync(fPath).mtimeMs
                if (mtime > latestTime) {
                  latestTime = mtime
                  latestDir = tiPath
                }
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  return latestDir
}

/**
 * ダウンロード完了後にディレクトリを開くか判定して実行する。
 * 環境変数 YTDL_OPEN_DIR で動作を制御。
 *
 * @param {string} dirPath - 保存先ベースディレクトリパス
 * @param {object} options
 * @param {Function} options.confirm - ユーザー確認関数 (message) => Promise<boolean>
 * @param {Function} options.log - ログ出力関数 (message) => void
 * @param {string} options.openDirMessage - 確認メッセージ
 */
export async function maybeOpenDir(dirPath, { confirm, log, openDirMessage }) {
  const opener = getOpenCommand()
  if (!opener) return

  // 優先順位: 環境変数 > config.json > TTY確認
  const env = process.env.YTDL_OPEN_DIR
  if (env === 'false' || env === '0') return

  const baseDir = expandHome(dirPath || '~/Downloads')
  if (!existsSync(baseDir)) return

  // 実際のダウンロードディレクトリを探す（最新メディアファイルの親ディレクトリ）
  const actualDir = findLatestDownloadDir(baseDir) || baseDir

  if (env === 'true' || env === '1') {
    await openDirectory(actualDir)
    return
  }

  // 環境変数未設定: config.json の openDir 設定を参照
  try {
    const { readConfig } = await import('./backends/analyzer.js')
    const config = readConfig()
    if (config.openDir === 'auto') {
      await openDirectory(actualDir)
      return
    }
    if (config.openDir === 'never') return
    // config.openDir === 'ask' or undefined → 以下の TTY 確認へ
  } catch { /* config 読み取り失敗時はフォールスルー */ }

  // TTY でなければスキップ
  if (!process.stdin.isTTY) return

  // ユーザーに確認
  const shouldOpen = await confirm(openDirMessage)
  if (shouldOpen) {
    await openDirectory(actualDir)
  }
}
