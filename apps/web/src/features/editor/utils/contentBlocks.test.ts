import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, ElementNodeSchema } from '@openwish/project-schema'
import { CONTENT_BLOCKS, createContentBlock } from './contentBlocks'

describe('createContentBlock', () => {
  it.each(CONTENT_BLOCKS)('creates a schema-valid $label group', ({ kind }) => {
    const elements = createContentBlock(kind, DEFAULT_THEME)
    const groupIds = new Set(elements.map((element) => element.groupId))

    expect(elements.length).toBeGreaterThan(1)
    expect(groupIds.size).toBe(1)
    expect(elements.every((element) => ElementNodeSchema.safeParse(element).success)).toBe(true)
  })
})
