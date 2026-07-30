import { v4 as uuidv4 } from 'uuid'
import type { ElementNode, Theme } from '@openwish/project-schema'

export type ContentBlockKind = 'hero' | 'photo-caption' | 'quote' | 'event-details' | 'closing'

export const CONTENT_BLOCKS: Array<{
  kind: ContentBlockKind
  label: string
  description: string
  mark: string
}> = [
  {
    kind: 'hero',
    label: 'Judul pembuka',
    description: 'Eyebrow, judul, dan nama penerima',
    mark: 'Aa',
  },
  {
    kind: 'photo-caption',
    label: 'Foto + caption',
    description: 'Frame foto dengan keterangan',
    mark: '▧',
  },
  {
    kind: 'quote',
    label: 'Pesan kutipan',
    description: 'Kutipan editorial yang hangat',
    mark: '“”',
  },
  {
    kind: 'event-details',
    label: 'Detail acara',
    description: 'Hitung mundur dan simpan tanggal',
    mark: '12',
  },
  { kind: 'closing', label: 'Penutup', description: 'Ucapan akhir dan tombol aksi', mark: '→' },
]

function base(type: ElementNode['type'], groupId: string, zIndex: number) {
  return {
    id: uuidv4(),
    type,
    rotation: 0,
    zIndex,
    locked: false,
    groupId,
  }
}

function text(
  groupId: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  theme: Theme,
  props: Partial<Extract<ElementNode, { type: 'text' }>['props']> = {},
): Extract<ElementNode, { type: 'text' }> {
  return {
    ...base('text', groupId, zIndex),
    type: 'text',
    x,
    y,
    width,
    height,
    props: {
      content,
      fontFamily: theme.bodyFont,
      fontSize: 18,
      color: theme.text,
      lineHeight: 1.35,
      textAlign: 'center',
      verticalAlign: 'middle',
      ...props,
    },
  }
}

export function createContentBlock(kind: ContentBlockKind, theme: Theme): ElementNode[] {
  const groupId = uuidv4()
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const futureEnd = new Date(future.getTime() + 2 * 60 * 60 * 1000)

  if (kind === 'hero') {
    return [
      text(groupId, 'SEBUAH MOMEN SPESIAL', 42, 210, 306, 34, 0, theme, {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        color: theme.primary,
      }),
      text(groupId, 'Judul Ceritamu', 30, 256, 330, 118, 1, theme, {
        fontFamily: theme.headingFont,
        fontSize: 38,
        fontWeight: 700,
        lineHeight: 1.08,
      }),
      text(groupId, 'Nama penerima', 60, 386, 270, 48, 2, theme, {
        fontFamily: theme.headingFont,
        fontStyle: 'italic',
        fontSize: 21,
        color: theme.secondary,
      }),
    ]
  }

  if (kind === 'photo-caption') {
    return [
      {
        ...base('shape', groupId, 0),
        type: 'shape',
        x: 36,
        y: 150,
        width: 318,
        height: 430,
        props: {
          shape: 'rectangle',
          fill: theme.surface,
          stroke: theme.accent,
          strokeWidth: 2,
          borderRadius: 18,
        },
      },
      {
        ...base('image', groupId, 1),
        type: 'image',
        x: 52,
        y: 166,
        width: 286,
        height: 330,
        props: { alt: 'Foto kenangan', objectFit: 'cover', borderRadius: 12, decorative: false },
      },
      text(
        groupId,
        'Tambahkan caption yang membuat foto ini lebih berarti.',
        60,
        510,
        270,
        54,
        2,
        theme,
        {
          fontFamily: theme.headingFont,
          fontSize: 16,
          fontStyle: 'italic',
        },
      ),
    ]
  }

  if (kind === 'quote') {
    return [
      text(groupId, '“', 36, 190, 90, 100, 0, theme, {
        fontFamily: theme.headingFont,
        fontSize: 88,
        color: theme.accent,
        textAlign: 'left',
      }),
      text(groupId, 'Tulis pesan yang ingin selalu mereka ingat.', 42, 274, 306, 200, 1, theme, {
        fontFamily: theme.headingFont,
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.3,
      }),
      text(groupId, '— Namamu', 78, 494, 234, 40, 2, theme, {
        fontSize: 13,
        color: theme.secondary,
      }),
    ]
  }

  if (kind === 'event-details') {
    return [
      text(groupId, 'MENUJU HARI SPESIAL', 50, 170, 290, 34, 0, theme, {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.8,
        color: theme.primary,
      }),
      {
        ...base('countdown', groupId, 1),
        type: 'countdown',
        x: 32,
        y: 224,
        width: 326,
        height: 122,
        props: {
          target: future.toISOString(),
          label: 'Sampai kita bertemu',
          expiredLabel: 'Hari spesial telah tiba',
          showLabels: true,
          color: theme.text,
          accentColor: theme.primary,
        },
      },
      {
        ...base('saveDate', groupId, 2),
        type: 'saveDate',
        x: 48,
        y: 390,
        width: 294,
        height: 104,
        props: {
          title: 'Acara spesial',
          startAt: future.toISOString(),
          endAt: futureEnd.toISOString(),
          buttonLabel: 'Simpan ke Kalender',
        },
      },
    ]
  }

  return [
    text(groupId, 'TERIMA KASIH', 50, 232, 290, 34, 0, theme, {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 2,
      color: theme.secondary,
    }),
    text(groupId, 'Kehadiranmu membuat cerita ini semakin lengkap.', 42, 286, 306, 154, 1, theme, {
      fontFamily: theme.headingFont,
      fontSize: 28,
      fontWeight: 600,
    }),
    {
      ...base('button', groupId, 2),
      type: 'button',
      x: 92,
      y: 480,
      width: 206,
      height: 52,
      props: {
        label: 'Buka Tautan',
        variant: 'primary',
        backgroundColor: theme.primary,
        textColor: theme.surface,
        borderRadius: 12,
        fontWeight: 700,
      },
    },
  ]
}
