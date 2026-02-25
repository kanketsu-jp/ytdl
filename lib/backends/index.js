import { YtdlpBackend } from './ytdlp.js'
import { TorrentBackend } from './torrent.js'
import { StreamBackend } from './stream.js'
import { AnalyzerBackend } from './analyzer.js'

/** 登録済みバックエンドの一覧（優先順位順） */
const backends = [
  new TorrentBackend(),
  new StreamBackend(),
  new YtdlpBackend(),
  new AnalyzerBackend(),
]

/**
 * URL からバックエンドを選択する（同期版、isAvailable を考慮しない）。
 * canHandle が true を返した最初のバックエンドを使用する。
 * @param {string} url
 * @returns {Backend | undefined}
 */
export function getBackend(url) {
  return backends.find((b) => b.canHandle(url))
}

/**
 * URL からバックエンドを選択する（非同期版、isAvailable を考慮）。
 * canHandle が true かつ isAvailable() が true の最初のバックエンドを返す。
 * @param {string} url
 * @returns {Promise<Backend | undefined>}
 */
export async function getAvailableBackend(url) {
  for (const b of backends) {
    if (b.canHandle(url) && await b.isAvailable()) {
      return b
    }
  }
  return undefined
}

/**
 * 名前でバックエンドを取得する（--via オプション用）。
 * @param {string} name
 * @returns {Backend | undefined}
 */
export function getBackendByName(name) {
  return backends.find((b) => b.name === name)
}

/**
 * 全バックエンドを返す。
 * @returns {Backend[]}
 */
export function getAllBackends() {
  return backends
}
