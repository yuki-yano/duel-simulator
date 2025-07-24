import { z } from "zod"
import { DeckConfigurationSchema, DeckCardIdsMappingSchema } from "@/client/schemas/replay"

// リクエストスキーマ
export const SaveDeckImageRequestSchema = z.object({
  hash: z.string().min(1),
  imageData: z.string().min(1),
  mainDeckCount: z.number().int().min(0).max(80),
  extraDeckCount: z.number().int().min(0).max(30),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
})

export const SaveGameStateRequestSchema = z.object({
  sessionId: z.string().optional(),
  stateJson: z.string().min(1),
  deckImageHash: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["replay", "snapshot"]).default("replay"),
  version: z.string().default("1.0"),
  deckConfig: DeckConfigurationSchema,
  deckCardIds: DeckCardIdsMappingSchema,
  ogpImageData: z.string().optional(), // OGP画像データ（base64）
})

// レスポンススキーマ
export const ErrorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  details: z.any().optional(),
})

export const SaveStateSuccessResponseSchema = z.object({
  success: z.boolean(),
  id: z.string(),
  sessionId: z.string(),
  shareUrl: z.string(),
})

export const DeckImageResponseSchema = z.object({
  imageDataUrl: z.string(),
  mainDeckCount: z.number(),
  extraDeckCount: z.number(),
  sourceWidth: z.number(),
  sourceHeight: z.number(),
})

export const SavedStateResponseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  stateJson: z.string(),
  deckImageHash: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  version: z.string(),
  deckConfig: z.string(),
  deckCardIds: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

// 型定義のエクスポート
export type SaveDeckImageRequest = z.infer<typeof SaveDeckImageRequestSchema>
export type SaveGameStateRequest = z.infer<typeof SaveGameStateRequestSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type SaveStateSuccessResponse = z.infer<typeof SaveStateSuccessResponseSchema>
export type DeckImageResponse = z.infer<typeof DeckImageResponseSchema>
export type SavedStateResponse = z.infer<typeof SavedStateResponseSchema>
