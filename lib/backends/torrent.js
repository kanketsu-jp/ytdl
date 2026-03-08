import * as p from '@clack/prompts'
import pc from 'picocolors'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Backend } from './base.js'
import { isBackendDepAvailable, checkBackendDep } from '../check-deps.js'

export class TorrentBackend extends Backend {
  name = 'torrent'

  /**
   * magnet: リンク、.torrent URL、またはローカル .torrent ファイルパスを処理できる。
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    if (url.startsWith('magnet:')) return true
    if (/\.torrent(\?.*)?$/.test(url)) return true
    return false
  }

  /**
   * ローカル .torrent ファイルパスを絶対パスに解決する。
   * magnet: や http(s): はそのまま返す。
   * @param {string} url
   * @returns {string}
   */
  _resolveInput(url) {
    if (url.startsWith('magnet:') || /^https?:\/\//i.test(url)) return url
    // ローカルファイルパスとして扱う
    const absPath = resolve(url)
    if (!existsSync(absPath)) {
      throw new Error(`ファイルが見つかりません: ${absPath}`)
    }
    return absPath
  }

  /**
   * webtorrent がインストール済みか判定する。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return isBackendDepAvailable('webtorrent')
  }

  /**
   * webtorrent がインストールされているか確認し、なければインストールを尋ねる。
   * @returns {Promise<boolean>}
   */
  async checkDeps() {
    return checkBackendDep('webtorrent')
  }

  /**
   * torrent のメタデータを取得して表示する。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<void>}
   */
  async getInfo(url, opts = {}) {
    const input = this._resolveInput(url)
    const WebTorrent = await this._loadWebtorrent()
    const client = new WebTorrent({ uploadLimit: 50 * 1024 })

    const s = p.spinner()
    s.start('トレントのメタデータを取得中...')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy()
        s.stop('タイムアウト: メタデータを取得できませんでした')
        reject(new Error('torrent metadata timeout'))
      }, 30_000)

      client.add(input, { path: '/tmp' }, (torrent) => {
        clearTimeout(timeout)
        client.destroy()

        const totalSize = torrent.files.reduce((sum, f) => sum + f.length, 0)
        const sizeMB = (totalSize / 1024 / 1024).toFixed(1)

        s.stop('メタデータを取得しました')

        const infoLines = [
          `${pc.dim('名前')}       ${torrent.name}`,
          `${pc.dim('サイズ')}    ${sizeMB} MB`,
          `${pc.dim('ファイル数')} ${torrent.files.length}`,
        ]

        if (torrent.files.length > 0 && torrent.files.length <= 10) {
          for (const f of torrent.files) {
            const fMB = (f.length / 1024 / 1024).toFixed(1)
            infoLines.push(`  ${pc.dim('•')} ${f.name} ${pc.dim(`(${fMB} MB)`)}`)
          }
        } else if (torrent.files.length > 10) {
          for (let i = 0; i < 5; i++) {
            const f = torrent.files[i]
            const fMB = (f.length / 1024 / 1024).toFixed(1)
            infoLines.push(`  ${pc.dim('•')} ${f.name} ${pc.dim(`(${fMB} MB)`)}`)
          }
          infoLines.push(`  ${pc.dim(`... 他 ${torrent.files.length - 5} ファイル`)}`)
        }

        p.note(infoLines.join('\n'), 'トレント情報')
        resolve({ code: 0 })
      })
    })
  }

  /**
   * webtorrent でダウンロードを実行する。
   * プログレス（パーセント / 速度 / ピア数）をリアルタイム表示する。
   * @param {string} url
   * @param {object} opts
   * @param {string} opts.outputDir - 保存先ディレクトリ
   * @returns {Promise<{code: number}>}
   */
  async download(url, opts = {}) {
    const input = this._resolveInput(url)
    const WebTorrent = await this._loadWebtorrent()
    // 最低限のアップロードを許可（Tit-for-Tat でピアから拒否されないため）
    const client = new WebTorrent({ uploadLimit: 50 * 1024 })

    // ~ を展開する
    const baseDir = (opts.outputDir ?? '~/Downloads').replace(/^~/, process.env.HOME ?? '~')

    // 匿名モード: 日付ベースのディレクトリを構築
    let outputDir = baseDir
    const isAnon = opts.anon === true
    let anonDir = null
    if (isAnon) {
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const timeStr = String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0')
      anonDir = join(baseDir, dateStr, `${timeStr}_001`)
      outputDir = anonDir
      mkdirSync(outputDir, { recursive: true })
    }

    const s = p.spinner()
    s.start('トレントのメタデータを取得中...')

    return new Promise((resolvePromise) => {
      let peerFound = false
      let metadataResolved = false

      // ピア発見タイムアウト（120秒）
      const peerTimeout = setTimeout(() => {
        if (!peerFound && metadataResolved) {
          clearInterval(interval)
          process.stdout.write('\n')
          client.destroy()
          p.log.warn('120秒経過してもピアが見つかりません')
          p.log.info('考えられる原因:')
          p.log.info(`  ${pc.dim('•')} トレントのシーダーがいない（デッドトレント）`)
          p.log.info(`  ${pc.dim('•')} トラッカーが応答しない`)
          p.log.info(`  ${pc.dim('•')} ファイアウォール/NATがブロックしている`)
          resolvePromise({ code: 1 })
        }
      }, 120_000)

      let interval

      client.add(input, { path: isAnon ? outputDir : baseDir }, (torrent) => {
        metadataResolved = true
        s.stop(`ダウンロード開始: ${pc.bold(isAnon ? '***' : torrent.name)}`)
        p.log.info(`保存先: ${pc.cyan(outputDir)}`)

        const startTime = Date.now()

        // ピア検出
        torrent.on('wire', () => {
          if (!peerFound) {
            peerFound = true
            clearTimeout(peerTimeout)
          }
        })

        // トラッカーエラーの表示
        torrent.on('trackerWarning', (err) => {
          p.log.warn(`トラッカー警告: ${err.message}`)
        })

        interval = setInterval(() => {
          const percent = Math.floor(torrent.progress * 100)
          const speedMBps = (torrent.downloadSpeed / 1024 / 1024).toFixed(2)
          const peers = torrent.numPeers

          const bar = _progressBar(torrent.progress, 20)
          let line = `\r  ${bar} ${pc.bold(`${percent}%`)}  ${pc.dim(`${speedMBps} MB/s`)}  ${pc.dim(`ピア: ${peers}`)}`

          // ピア0の場合に経過時間を表示
          if (peers === 0) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000)
            line += `  ${pc.yellow(`(${elapsed}秒経過 - ピア探索中...)`)}`
          }

          process.stdout.write(line)
        }, 500)

        torrent.on('done', () => {
          clearInterval(interval)
          clearTimeout(peerTimeout)
          // 進捗行を終了
          process.stdout.write('\n')
          client.destroy()

          // 匿名モード: ファイルをリネーム
          if (isAnon && anonDir) {
            const now = new Date()
            const timeStr = String(now.getHours()).padStart(2, '0') +
              String(now.getMinutes()).padStart(2, '0') +
              String(now.getSeconds()).padStart(2, '0')
            for (const f of torrent.files) {
              const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : ''
              const newName = `${timeStr}_001${ext}`
              const oldPath = join(outputDir, f.path)
              const newPath = join(outputDir, newName)
              try { renameSync(oldPath, newPath) } catch { /* ignore rename errors */ }
            }
          }

          p.log.success(`ダウンロード完了: ${pc.bold(isAnon ? '***' : torrent.name)}`)
          resolvePromise({ code: 0 })
        })

        torrent.on('error', (err) => {
          clearInterval(interval)
          clearTimeout(peerTimeout)
          process.stdout.write('\n')
          client.destroy()
          p.log.error(`ダウンロードエラー: ${err.message}`)
          resolvePromise({ code: 1 })
        })
      })

      client.on('error', (err) => {
        clearTimeout(peerTimeout)
        s.stop(`エラー: ${err.message}`)
        resolvePromise({ code: 1 })
      })
    })
  }

  /**
   * webtorrent をオンデマンドでインポートする。
   * @returns {Promise<typeof import('webtorrent')['default']>}
   */
  async _loadWebtorrent() {
    try {
      const mod = await import('webtorrent')
      return mod.default
    } catch {
      throw new Error(
        'webtorrent がインストールされていません。\n' +
        `  ${pc.cyan('npm install -g webtorrent')} を実行してインストールしてください。`
      )
    }
  }
}

/**
 * プログレスバー文字列を生成する。
 * @param {number} progress - 0.0 ~ 1.0
 * @param {number} width - バーの幅（文字数）
 * @returns {string}
 */
function _progressBar(progress, width) {
  const filled = Math.round(progress * width)
  const empty = width - filled
  return pc.green('█'.repeat(filled)) + pc.dim('░'.repeat(empty))
}
