import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import type { Scene } from '@openwish/project-schema'
import { SceneRenderer } from './SceneRenderer'

function makeScene(elements: Scene['elements']): Scene {
  return {
    id: uuidv4(),
    name: 'Scene test',
    order: 0,
    baseWidth: 390,
    baseHeight: 844,
    background: { type: 'color', color: '#FFFFFF' },
    elements,
  }
}

it('keeps public button links interactive', () => {
  const id = uuidv4()
  render(
    <SceneRenderer
      scene={makeScene([
        {
          id,
          type: 'button',
          x: 10,
          y: 10,
          width: 160,
          height: 44,
          rotation: 0,
          zIndex: 1,
          locked: false,
          props: { label: 'Buka', url: 'https://example.com', variant: 'primary' },
        },
      ])}
    />,
  )

  const link = screen.getByRole('link', { name: 'Buka' })
  expect(link).toHaveAttribute('href', 'https://example.com/')
  expect(link.closest(`[data-element-id="${id}"]`)).toHaveStyle({ pointerEvents: 'auto' })
})

describe('audio control', () => {
  const scene = makeScene([
    {
      id: uuidv4(),
      type: 'audioControl',
      x: 10,
      y: 10,
      width: 160,
      height: 44,
      rotation: 0,
      zIndex: 1,
      locked: false,
      props: { label: 'Musik', compact: false },
    },
  ])

  it('toggles from click and keyboard in viewer mode', () => {
    const onToggle = vi.fn()
    render(<SceneRenderer scene={scene} onAudioToggle={onToggle} />)

    const control = screen.getByRole('button', { name: 'Musik' })
    fireEvent.click(control)
    fireEvent.keyDown(control, { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledTimes(2)
  })
})
