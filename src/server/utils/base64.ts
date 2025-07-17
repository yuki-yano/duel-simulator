/**
 * Base64エンコード/デコードのユーティリティ
 */

/**
 * Base64データURLをArrayBufferに変換
 * @param dataUrl - data:image/png;base64,... 形式の文字列
 * @returns ArrayBuffer
 */
export function base64ToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "")
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * ArrayBufferをBase64データURLに変換
 * @param arrayBuffer - 画像データのArrayBuffer
 * @param mimeType - MIMEタイプ (例: "image/png")
 * @returns Base64データURL
 */
export function arrayBufferToBase64(arrayBuffer: ArrayBuffer, mimeType: string = "image/png"): string {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return `data:${mimeType};base64,${base64}`
}
