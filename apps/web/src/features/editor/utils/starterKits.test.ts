import { describe, expect, it } from 'vitest'
import { ProjectDocumentSchema } from '@openwish/project-schema'
import { createStarterKit } from './starterKits'

describe('createStarterKit', () => {
  it('creates a complete, schema-valid four-scene story', () => {
    const kit = createStarterKit({
      occasion: 'birthday',
      recipient: 'Nara',
      sender: 'Keluarga',
      tone: 'cheerful',
      eventAt: '2030-08-17T10:00:00+07:00',
      location: 'Aula Merdeka, Jakarta',
    })

    const parsed = ProjectDocumentSchema.safeParse({
      schemaVersion: 2,
      project: { title: kit.title, locale: 'id-ID', theme: kit.theme },
      scenes: kit.scenes,
    })

    expect(parsed.success).toBe(true)
    expect(kit.scenes).toHaveLength(4)
    expect(kit.title).toContain('Nara')
    expect(kit.scenes.map((scene) => scene.order)).toEqual([0, 1, 2, 3])
  })

  it('uses a future countdown when the supplied date is invalid or expired', () => {
    const kit = createStarterKit({
      occasion: 'invitation',
      recipient: 'Teman-teman',
      tone: 'minimal',
      eventAt: '2020-01-01T00:00:00.000Z',
    })
    const countdown = kit.scenes
      .flatMap((scene) => scene.elements)
      .find((element) => element.type === 'countdown')

    expect(countdown?.type).toBe('countdown')
    if (countdown?.type === 'countdown') {
      expect(new Date(countdown.props.target).getTime()).toBeGreaterThan(Date.now())
    }
  })
})
