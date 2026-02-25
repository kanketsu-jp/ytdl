import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Backend } from './base.js'
import { isBackendDepAvailable, checkBackendDep } from '../check-deps.js'

export class TorrentBackend extends Backend {
  name = 'torrent'

  /**
   * magnet: リンクまたは .torrent URL を処理できる。
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    if (url.startsWith('magnet:')) return true
    if (/\.torrent(\?.*)?$/.test(url)) return true
    return false
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
    const WebTorrent = await this._loadWebtorrent()
    const client = new WebTorrent({ uploadLimit: 1 })

    const s = p.spinner()
    s.start('トレントのメタデータを取得中...')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy()
        s.stop('タイムアウト: メタデータを取得できませんでした')
        reject(new Error('torrent metadata timeout'))
      }, 30_000)

      client.add(url, { path: '/tmp' }, (torrent) => {
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
    const WebTorrent = await this._loadWebtorrent()
    // アップロードを実質ゼロに制限（ダウンロード特化）
    const client = new WebTorrent({ uploadLimit: 1 })

    // ~ を展開する
    const outputDir = (opts.outputDir ?? '~/Downloads').replace(/^~/, process.env.HOME ?? '~')

    const s = p.spinner()
    s.start('トレントのメタデータを取得中...')

    return new Promise((resolve) => {
      client.add(url, { path: outputDir }, (torrent) => {
        s.stop(`ダウンロード開始: ${pc.bold(torrent.name)}`)
        p.log.info(`保存先: ${pc.cyan(outputDir)}`)

        let lastPercent = -1

        const interval = setInterval(() => {
          const percent = Math.floor(torrent.progress * 100)
          const speedMBps = (torrent.downloadSpeed / 1024 / 1024).toFixed(2)
          const peers = torrent.numPeers

          if (percent !== lastPercent) {
            lastPercent = percent
            const bar = _progressBar(torrent.progress, 20)
            process.stdout.write(
              `\r  ${bar} ${pc.bold(`${percent}%`)}  ${pc.dim(`${speedMBps} MB/s`)}  ${pc.dim(`ピア: ${peers}`)}`
            )
          }
        }, 500)

        torrent.on('done', () => {
          clearInterval(interval)
          // 進捗行を終了
          process.stdout.write('\n')
          client.destroy()
          p.log.success(`ダウンロード完了: ${pc.bold(torrent.name)}`)
          resolve({ code: 0 })
        })

        torrent.on('error', (err) => {
          clearInterval(interval)
          process.stdout.write('\n')
          client.destroy()
          p.log.error(`ダウンロードエラー: ${err.message}`)
          resolve({ code: 1 })
        })
      })

      client.on('error', (err) => {
        s.stop(`エラー: ${err.message}`)
        resolve({ code: 1 })
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
