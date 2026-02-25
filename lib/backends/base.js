/**
 * バックエンド基底クラス。
 * すべてのバックエンドはこのクラスを継承して実装する。
 */
export class Backend {
  name = 'base'

  /**
   * このバックエンドが指定された URL を処理できるか判定する。
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    return false
  }

  /**
   * バックエンドが利用可能か判定する（依存パッケージがインストール済みか）。
   * デフォルトは true。npm パッケージに依存するバックエンドはオーバーライドする。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return true
  }

  /**
   * 依存ツールの存在チェック。
   * 不足している場合はインタラクティブにインストールを尋ねる。
   * @returns {Promise<boolean>} インストール成功なら true
   */
  async checkDeps() {
    return true
  }

  /**
   * メディア情報を取得する。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async getInfo(url, opts) {
    throw new Error('not implemented')
  }

  /**
   * ダウンロードを実行する。
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<{code: number, stderr: string}>}
   */
  async download(url, opts) {
    throw new Error('not implemented')
  }
}
