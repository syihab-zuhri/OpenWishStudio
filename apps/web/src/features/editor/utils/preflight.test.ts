import { describe, expect, it } from 'vitest'
import { createDefaultDocument } from '@openwish/project-schema'
import { runPublishPreflight } from './preflight'

describe('runPublishPreflight', () => {
  it('blocks a non-decorative image without alt text', () => {
    const document = createDefaultDocument('Uji')
    document.scenes[0].elements.push({
      id: crypto.randomUUID(),
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: 1,
      locked: false,
      props: { alt: '', decorative: false, objectFit: 'cover' },
    })

    expect(runPublishPreflight(document)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          elementId: document.scenes[0].elements[0].id,
        }),
      ]),
    )
  })

  it('warns about buttons without a destination', () => {
    const document = createDefaultDocument('Uji')
    document.scenes[0].elements.push({
      id: crypto.randomUUID(),
      type: 'button',
      x: 0,
      y: 0,
      width: 160,
      height: 44,
      rotation: 0,
      zIndex: 1,
      locked: false,
      props: { label: 'Buka', variant: 'primary' },
    })

    expect(runPublishPreflight(document)).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'warning' })]),
    )
  })
})
