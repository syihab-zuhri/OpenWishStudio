import { z } from 'zod'

// ─── Safe URL ────────────────────────────────────────────────────────────────

/**
 * `z.string().url()` only checks that `new URL()` parses — it accepts
 * `javascript:`, `data:`, `vbscript:` and `file:`. These values reach `href`,
 * `<img src>` and `background-image: url(...)` on public pages, so the scheme
 * has to be allow-listed explicitly.
 */
export const SafeUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const { protocol } = new URL(value)
      return protocol === 'https:' || protocol === 'http:'
    } catch {
      return false
    }
  }, 'URL harus menggunakan skema http atau https')

// ─── Element Prop Schemas ────────────────────────────────────────────────────

export const TextElementPropsSchema = z.object({
  content: z.string().max(5000),
  // Rendered into a CSS font-family value; keep it to font-name characters.
  fontFamily: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\s,'"\-_]+$/, 'Nama font tidak valid')
    .optional(),
  fontSize: z.number().min(4).max(300),
  fontWeight: z.number().optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
})

export const ImageElementPropsSchema = z.object({
  assetId: z.string().uuid().optional(),
  src: SafeUrlSchema.optional(),
  alt: z.string().max(500).default(''),
  objectFit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  decorative: z.boolean().default(false),
})

export const ShapeElementPropsSchema = z.object({
  shape: z.enum(['rectangle', 'circle', 'triangle', 'star', 'heart']),
  fill: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/)
    .optional(),
  stroke: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/)
    .optional(),
  strokeWidth: z.number().min(0).max(100).optional(),
  borderRadius: z.number().min(0).max(50).optional(),
})

export const IconElementPropsSchema = z.object({
  iconName: z.string().max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/)
    .optional(),
  size: z.number().min(8).max(512).optional(),
})

export const ButtonElementPropsSchema = z.object({
  label: z.string().max(200),
  // Opsional: tombol baru belum punya tujuan; renderer aman terhadap undefined
  url: SafeUrlSchema.optional(),
  variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/)
    .optional(),
  textColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/)
    .optional(),
  borderRadius: z.number().min(0).max(50).optional(),
})

export const AudioControlElementPropsSchema = z.object({
  label: z.string().max(200).optional(),
  compact: z.boolean().default(false),
})

// ─── Element Node ────────────────────────────────────────────────────────────

const BaseElementSchema = z.object({
  id: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().min(-360).max(360).default(0),
  zIndex: z.number().int().min(0),
  locked: z.boolean().default(false),
})

export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  props: TextElementPropsSchema,
})

export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  props: ImageElementPropsSchema,
})

export const ShapeElementSchema = BaseElementSchema.extend({
  type: z.literal('shape'),
  props: ShapeElementPropsSchema,
})

export const IconElementSchema = BaseElementSchema.extend({
  type: z.literal('icon'),
  props: IconElementPropsSchema,
})

export const ButtonElementSchema = BaseElementSchema.extend({
  type: z.literal('button'),
  props: ButtonElementPropsSchema,
})

export const AudioControlElementSchema = BaseElementSchema.extend({
  type: z.literal('audioControl'),
  props: AudioControlElementPropsSchema,
})

export const ElementNodeSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  IconElementSchema,
  ButtonElementSchema,
  AudioControlElementSchema,
])

// ─── Background ──────────────────────────────────────────────────────────────

export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('color'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/),
  }),
  z.object({
    type: z.literal('gradient'),
    gradient: z.object({
      direction: z.number().min(0).max(360),
      stops: z
        .array(
          z.object({
            color: z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/),
            position: z.number().min(0).max(100),
          }),
        )
        .min(2)
        .max(10),
    }),
  }),
  z.object({
    type: z.literal('image'),
    assetId: z.string().uuid().optional(),
    src: SafeUrlSchema.optional(),
    objectFit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  }),
])

// ─── Scene ───────────────────────────────────────────────────────────────────

export const SceneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(200),
  order: z.number().int().min(0),
  baseWidth: z.literal(390),
  baseHeight: z.number().int().min(100).max(10000),
  background: BackgroundSchema,
  elements: z.array(ElementNodeSchema).max(200),
})

// ─── Soundtrack ──────────────────────────────────────────────────────────────

export const SoundtrackSchema = z.object({
  assetId: z.string().uuid().optional(),
  libraryItemId: z.string().uuid().optional(),
  // URL publik file audio, di-resolve saat track dipilih di editor. Disimpan di
  // dokumen supaya halaman publik (anon, tanpa akses tabel library) bisa memutar.
  src: SafeUrlSchema.optional(),
  title: z.string().max(500).optional(),
  // Teks atribusi lisensi (mis. CC-BY) — wajib ditampilkan di halaman publik.
  attribution: z.string().max(1000).optional(),
  volume: z.number().min(0).max(1).default(1),
  loop: z.boolean().default(true),
})

// ─── Project Document ────────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 1

export const ProjectDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1).max(CURRENT_SCHEMA_VERSION),
  project: z.object({
    title: z.string().min(1).max(500),
    locale: z.string().max(35).default('id-ID'),
    soundtrack: SoundtrackSchema.optional(),
  }),
  scenes: z.array(SceneSchema).min(1).max(50),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>
export type Scene = z.infer<typeof SceneSchema>
export type ElementNode = z.infer<typeof ElementNodeSchema>
export type TextElement = z.infer<typeof TextElementSchema>
export type ImageElement = z.infer<typeof ImageElementSchema>
export type ShapeElement = z.infer<typeof ShapeElementSchema>
export type IconElement = z.infer<typeof IconElementSchema>
export type ButtonElement = z.infer<typeof ButtonElementSchema>
export type AudioControlElement = z.infer<typeof AudioControlElementSchema>
export type Background = z.infer<typeof BackgroundSchema>
export type Soundtrack = z.infer<typeof SoundtrackSchema>
