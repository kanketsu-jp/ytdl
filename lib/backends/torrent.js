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
   * トレントのピア可用性を事前チェックする。
   * メタデータ取得 + 短時間のピア探索を行い、ダウンロード可能か判定する。
   * @param {string} input - 解決済みの入力パス/URL
   * @param {typeof import('webtorrent')['default']} WebTorrent
   * @returns {Promise<{available: boolean, name: string, sizeMB: string, files: Array, peers: number}>}
   */
  async _checkPeerAvailability(input, WebTorrent) {
    const METADATA_TIMEOUT = 30_000
    const PEER_PROBE_TIMEOUT = 15_000

    const s = p.spinner()
    s.start('トレントの可用性をチェック中...')

    return new Promise((resolve) => {
      const client = new WebTorrent({ uploadLimit: 50 * 1024 })

      const metaTimer = setTimeout(() => {
        client.destroy()
        s.stop(pc.red('メタデータを取得できませんでした'))
        resolve({ available: false, name: null, sizeMB: null, files: [], peers: 0 })
      }, METADATA_TIMEOUT)

      client.on('error', (err) => {
        clearTimeout(metaTimer)
        s.stop(pc.red(`エラー: ${err.message}`))
        resolve({ available: false, name: null, sizeMB: null, files: [], peers: 0 })
      })

      client.add(input, { path: '/tmp' }, (torrent) => {
        clearTimeout(metaTimer)

        const totalSize = torrent.files.reduce((sum, f) => sum + f.length, 0)
        const sizeMB = (totalSize / 1024 / 1024).toFixed(1)
        const name = torrent.name
        const files = torrent.files.map(f => ({ name: f.name, sizeMB: (f.length / 1024 / 1024).toFixed(1) }))

        s.message(`メタデータ取得済み — ピアを探索中... (最大${PEER_PROBE_TIMEOUT / 1000}秒)`)

        let maxPeers = 0

        const peerInterval = setInterval(() => {
          if (torrent.numPeers > maxPeers) maxPeers = torrent.numPeers
        }, 500)

        // ピアが見つかったら即座に完了
        torrent.on('wire', () => {
          maxPeers = Math.max(maxPeers, torrent.numPeers)
          clearInterval(peerInterval)
          clearTimeout(probeTimer)
          client.destroy()
          s.stop(pc.green(`ピア発見: ${maxPeers}件 — ダウンロード可能`))
          resolve({ available: true, name, sizeMB, files, peers: maxPeers })
        })

        const probeTimer = setTimeout(() => {
          clearInterval(peerInterval)
          maxPeers = Math.max(maxPeers, torrent.numPeers)
          client.destroy()
          if (maxPeers > 0) {
            s.stop(pc.green(`ピア発見: ${maxPeers}件 — ダウンロード可能`))
            resolve({ available: true, name, sizeMB, files, peers: maxPeers })
          } else {
            s.stop(pc.red('ピアが見つかりません — デッドトレントの可能性'))
            resolve({ available: false, name, sizeMB, files, peers: 0 })
          }
        }, PEER_PROBE_TIMEOUT)
      })
    })
  }

  /**
   * webtorrent でダウンロードを実行する。
   * ダウンロード前にピア可用性チェックを行い、デッドトレントを事前検出する。
   * プログレス（パーセント / 速度 / ピア数）をリアルタイム表示する。
   * @param {string} url
   * @param {object} opts
   * @param {string} opts.outputDir - 保存先ディレクトリ
   * @returns {Promise<{code: number}>}
   */
  async download(url, opts = {}) {
    const input = this._resolveInput(url)
    const WebTorrent = await this._loadWebtorrent()

    // ── 事前チェック: ピア可用性 ──
    const probe = await this._checkPeerAvailability(input, WebTorrent)

    // トレント情報を表示
    if (probe.name) {
      const infoLines = [
        `${pc.dim('名前')}       ${probe.name}`,
        `${pc.dim('サイズ')}    ${probe.sizeMB} MB`,
        `${pc.dim('ファイル数')} ${probe.files.length}`,
        `${pc.dim('ピア')}       ${probe.peers > 0 ? pc.green(String(probe.peers)) : pc.red('0')}`,
      ]
      if (probe.files.length > 0 && probe.files.length <= 10) {
        for (const f of probe.files) {
          infoLines.push(`  ${pc.dim('•')} ${f.name} ${pc.dim(`(${f.sizeMB} MB)`)}`)
        }
      } else if (probe.files.length > 10) {
        for (let i = 0; i < 5; i++) {
          infoLines.push(`  ${pc.dim('•')} ${probe.files[i].name} ${pc.dim(`(${probe.files[i].sizeMB} MB)`)}`)
        }
        infoLines.push(`  ${pc.dim(`... 他 ${probe.files.length - 5} ファイル`)}`)
      }
      p.note(infoLines.join('\n'), 'トレント情報')
    }

    if (!probe.available) {
      p.log.error('ダウンロードを中止しました')
      p.log.info('考えられる原因:')
      p.log.info(`  ${pc.dim('•')} トレントのシーダーがいない（デッドトレント）`)
      p.log.info(`  ${pc.dim('•')} トラッカーが応答しない`)
      p.log.info(`  ${pc.dim('•')} ファイアウォール/NATがブロックしている`)
      return { code: 1 }
    }

    // ── ダウンロード実行 ──
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

    p.log.info(`ダウンロードを開始します...`)

    return new Promise((resolvePromise) => {
      client.add(input, { path: isAnon ? outputDir : baseDir }, (torrent) => {
        p.log.step(`ダウンロード中: ${pc.bold(isAnon ? '***' : torrent.name)}`)
        p.log.info(`保存先: ${pc.cyan(outputDir)}`)

        const interval = setInterval(() => {
          const percent = Math.floor(torrent.progress * 100)
          const speedMBps = (torrent.downloadSpeed / 1024 / 1024).toFixed(2)
          const peers = torrent.numPeers

          const bar = _progressBar(torrent.progress, 20)
          process.stdout.write(
            `\r  ${bar} ${pc.bold(`${percent}%`)}  ${pc.dim(`${speedMBps} MB/s`)}  ${pc.dim(`ピア: ${peers}`)}`
          )
        }, 500)

        torrent.on('done', () => {
          clearInterval(interval)
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
          process.stdout.write('\n')
          client.destroy()
          p.log.error(`ダウンロードエラー: ${err.message}`)
          resolvePromise({ code: 1 })
        })
      })

      client.on('error', (err) => {
        p.log.error(`エラー: ${err.message}`)
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
