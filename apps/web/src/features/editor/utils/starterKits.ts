import { v4 as uuidv4 } from 'uuid'
import type { ElementNode, Scene, Theme } from '@openwish/project-schema'

export type StarterOccasion = 'birthday' | 'wedding' | 'graduation' | 'anniversary' | 'invitation'

export type StarterTone = 'elegant' | 'cheerful' | 'romantic' | 'minimal'

export interface StarterKitInput {
  occasion: StarterOccasion
  recipient: string
  sender?: string
  tone: StarterTone
  eventAt?: string
  location?: string
}

export interface StarterKitResult {
  title: string
  theme: Theme
  scenes: Scene[]
}

const THEMES: Record<StarterTone, Theme> = {
  elegant: {
    primary: '#173F47',
    secondary: '#B9825A',
    accent: '#E7C9A9',
    text: '#153238',
    surface: '#FFF9F1',
    headingFont: 'Georgia, serif',
    bodyFont: 'Inter, sans-serif',
  },
  cheerful: {
    primary: '#6D5EF7',
    secondary: '#E86A92',
    accent: '#F2B84B',
    text: '#222038',
    surface: '#FFF9ED',
    headingFont: 'Inter, sans-serif',
    bodyFont: 'Inter, sans-serif',
  },
  romantic: {
    primary: '#9E3855',
    secondary: '#D78DA0',
    accent: '#D7A65B',
    text: '#4A2430',
    surface: '#FFF6F7',
    headingFont: 'Georgia, serif',
    bodyFont: 'Inter, sans-serif',
  },
  minimal: {
    primary: '#182326',
    secondary: '#657276',
    accent: '#C8A96A',
    text: '#182326',
    surface: '#F7F5EF',
    headingFont: 'Inter, sans-serif',
    bodyFont: 'Inter, sans-serif',
  },
}

const OCCASION_COPY: Record<
  StarterOccasion,
  { title: string; eyebrow: string; message: string; closing: string }
> = {
  birthday: {
    title: 'Selamat Ulang Tahun',
    eyebrow: 'Hari spesialmu tiba',
    message:
      'Semoga setiap langkah baru membawa cerita baik, tawa hangat, dan mimpi yang terwujud.',
    closing: 'Rayakan hari ini dengan bahagia.',
  },
  wedding: {
    title: 'Hari Bahagia',
    eyebrow: 'Sebuah awal yang indah',
    message:
      'Dua perjalanan bertemu, tumbuh dalam kasih, dan memilih berjalan bersama untuk selamanya.',
    closing: 'Kehadiranmu akan melengkapi kebahagiaan kami.',
  },
  graduation: {
    title: 'Selamat Wisuda',
    eyebrow: 'Satu pencapaian, banyak kemungkinan',
    message:
      'Kerja kerasmu telah membuka halaman baru. Terus melangkah dan ciptakan hal-hal yang berarti.',
    closing: 'Dunia menunggu karya terbaikmu.',
  },
  anniversary: {
    title: 'Happy Anniversary',
    eyebrow: 'Merayakan perjalanan bersama',
    message:
      'Terima kasih untuk setiap cerita, pelajaran, dan kebahagiaan yang kita tumbuhkan bersama.',
    closing: 'Untuk lebih banyak kenangan di tahun-tahun berikutnya.',
  },
  invitation: {
    title: 'Sebuah Undangan',
    eyebrow: 'Simpan tanggalnya',
    message:
      'Kami menyiapkan sebuah momen istimewa dan ingin membaginya bersama orang-orang terdekat.',
    closing: 'Kami menantikan kehadiranmu.',
  },
}

function textElement(
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  options: Partial<Extract<ElementNode, { type: 'text' }>['props']> = {},
): Extract<ElementNode, { type: 'text' }> {
  return {
    id: uuidv4(),
    type: 'text',
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    locked: false,
    props: {
      content,
      fontSize: 20,
      color: '#17171C',
      lineHeight: 1.35,
      textAlign: 'center',
      verticalAlign: 'middle',
      ...options,
    },
  }
}

function shapeElement(
  fill: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
): Extract<ElementNode, { type: 'shape' }> {
  return {
    id: uuidv4(),
    type: 'shape',
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    locked: false,
    opacity: 0.16,
    props: { shape: 'circle', fill },
  }
}

function scene(
  name: string,
  order: number,
  background: Scene['background'],
  elements: ElementNode[],
): Scene {
  return {
    id: uuidv4(),
    name,
    order,
    baseWidth: 390,
    baseHeight: 844,
    background,
    elements,
  }
}

function normalizedFutureDate(value?: string): string {
  const parsed = value ? new Date(value) : null
  if (parsed && Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now()) {
    return parsed.toISOString()
  }
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
}

export function createStarterKit(input: StarterKitInput): StarterKitResult {
  const recipient = input.recipient.trim() || 'Orang Spesial'
  const sender = input.sender?.trim()
  const location = input.location?.trim()
  const copy = OCCASION_COPY[input.occasion]
  const theme = THEMES[input.tone]
  const eventAt = normalizedFutureDate(input.eventAt)
  const title = `${copy.title} — ${recipient}`

  return {
    title,
    theme,
    scenes: [
      scene(
        'Pembuka',
        0,
        {
          type: 'gradient',
          gradient: {
            direction: 145,
            stops: [
              { color: theme.surface, position: 0 },
              { color: theme.accent, position: 100 },
            ],
          },
        },
        [
          shapeElement(theme.primary, 246, 62, 210, 210, 0),
          textElement(copy.eyebrow.toUpperCase(), 40, 222, 310, 38, 1, {
            fontFamily: theme.bodyFont,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: theme.primary,
          }),
          textElement(copy.title, 32, 286, 326, 138, 2, {
            fontFamily: theme.headingFont,
            fontSize: 42,
            fontWeight: 700,
            lineHeight: 1.08,
            color: theme.text,
          }),
          textElement(recipient, 45, 452, 300, 70, 3, {
            fontFamily: theme.headingFont,
            fontSize: 25,
            fontStyle: 'italic',
            color: theme.secondary,
          }),
        ],
      ),
      scene('Pesan', 1, { type: 'color', color: theme.surface }, [
        textElement('“', 42, 168, 80, 96, 0, {
          fontFamily: theme.headingFont,
          fontSize: 86,
          color: theme.accent,
          textAlign: 'left',
        }),
        textElement(copy.message, 42, 260, 306, 230, 1, {
          fontFamily: theme.headingFont,
          fontSize: 29,
          fontWeight: 600,
          lineHeight: 1.3,
          color: theme.text,
        }),
        textElement(sender ? `— ${sender}` : '— Dengan hangat', 70, 540, 250, 46, 2, {
          fontFamily: theme.bodyFont,
          fontSize: 14,
          color: theme.secondary,
        }),
      ]),
      scene(
        'Detail Momen',
        2,
        {
          type: 'gradient',
          gradient: {
            direction: 180,
            stops: [
              { color: theme.primary, position: 0 },
              { color: theme.text, position: 100 },
            ],
          },
        },
        [
          textElement('MENUJU MOMEN SPESIAL', 45, 142, 300, 36, 0, {
            fontFamily: theme.bodyFont,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.8,
            color: theme.surface,
          }),
          {
            id: uuidv4(),
            type: 'countdown',
            x: 32,
            y: 220,
            width: 326,
            height: 128,
            rotation: 0,
            zIndex: 1,
            locked: false,
            props: {
              target: eventAt,
              label: 'Sampai hari bahagia',
              expiredLabel: 'Hari istimewa telah tiba',
              showLabels: true,
              color: theme.surface,
              accentColor: theme.accent,
            },
          },
          ...(location
            ? [
                {
                  id: uuidv4(),
                  type: 'location' as const,
                  x: 40,
                  y: 410,
                  width: 310,
                  height: 190,
                  rotation: 0,
                  zIndex: 2,
                  locked: false,
                  props: {
                    name: 'Lokasi Acara',
                    address: location,
                    buttonLabel: 'Buka Petunjuk Arah',
                    showMap: false,
                  },
                },
              ]
            : [
                textElement('Tambahkan lokasi atau detail acara di sini.', 55, 425, 280, 110, 2, {
                  fontFamily: theme.bodyFont,
                  fontSize: 17,
                  color: theme.surface,
                }),
              ]),
        ],
      ),
      scene('Penutup', 3, { type: 'color', color: theme.surface }, [
        shapeElement(theme.secondary, -72, 570, 270, 270, 0),
        textElement('TERIMA KASIH', 48, 220, 294, 34, 1, {
          fontFamily: theme.bodyFont,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2.4,
          color: theme.secondary,
        }),
        textElement(copy.closing, 42, 286, 306, 180, 2, {
          fontFamily: theme.headingFont,
          fontSize: 31,
          fontWeight: 600,
          lineHeight: 1.25,
          color: theme.text,
        }),
        textElement(sender ? `Dari ${sender}` : 'Dibuat khusus untukmu', 70, 506, 250, 48, 3, {
          fontFamily: theme.bodyFont,
          fontSize: 14,
          color: theme.primary,
        }),
      ]),
    ],
  }
}
