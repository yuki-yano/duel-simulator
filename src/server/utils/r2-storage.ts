import type { R2Bucket } from "@cloudflare/workers-types"

/**
 * R2ストレージ操作のヘルパー関数
 */

export type R2PutOptions = {
  contentType: string
  cacheControl?: string
  customMetadata?: Record<string, string>
}

/**
 * Base64データURLをR2に保存
 * @param bucket - R2Bucket
 * @param key - 保存先のキー
 * @param dataUrl - Base64データURL
 * @param options - 保存オプション
 */
export async function saveBase64ToR2(
  bucket: R2Bucket,
  key: string,
  dataUrl: string,
  options: R2PutOptions,
): Promise<void> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "")
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  await bucket.put(key, bytes.buffer, {
    httpMetadata: {
      contentType: options.contentType,
      cacheControl: options.cacheControl ?? "public, max-age=31536000, immutable",
    },
    customMetadata: options.customMetadata,
  })
}

/**
 * R2から画像を取得してArrayBufferで返す
 * @param bucket - R2Bucket
 * @param key - 取得するキー
 * @returns ArrayBuffer | null
 */
export async function getImageFromR2(bucket: R2Bucket, key: string): Promise<ArrayBuffer | null> {
  const object = await bucket.get(key)
  if (!object) {
    return null
  }
  return await object.arrayBuffer()
}

/**
 * R2から画像とメタデータを取得
 * @param bucket - R2Bucket
 * @param key - 取得するキー
 * @returns 画像データとカスタムメタデータ
 */
export async function getImageWithMetadataFromR2(
  bucket: R2Bucket,
  key: string,
): Promise<{ arrayBuffer: ArrayBuffer; customMetadata?: Record<string, string> } | null> {
  const object = await bucket.get(key)
  if (!object) {
    return null
  }

  return {
    arrayBuffer: await object.arrayBuffer(),
    customMetadata: object.customMetadata,
  }
}

/**
 * ファイル拡張子からContent-Typeを判定
 * @param filename - ファイル名
 * @returns Content-Type
 */
export function getContentTypeFromFilename(filename: string): string {
  if (filename.endsWith(".webp")) return "image/webp"
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg"
  if (filename.endsWith(".png")) return "image/png"
  if (filename.endsWith(".gif")) return "image/gif"
  return "application/octet-stream"
}
