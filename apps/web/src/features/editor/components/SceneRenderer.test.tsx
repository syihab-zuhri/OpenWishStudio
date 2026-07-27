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

describe('editor 2.0 elements', () => {
  it('does not render hidden elements', () => {
    render(
      <SceneRenderer
        scene={makeScene([
          {
            id: uuidv4(),
            type: 'text',
            x: 0,
            y: 0,
            width: 200,
            height: 50,
            rotation: 0,
            zIndex: 1,
            locked: false,
            visible: false,
            props: { content: 'Rahasia', fontSize: 16, color: '#000000' },
          },
        ])}
      />,
    )

    expect(screen.queryByText('Rahasia')).not.toBeInTheDocument()
  })

  it('renders a save-the-date link for public viewers', () => {
    render(
      <SceneRenderer
        scene={makeScene([
          {
            id: uuidv4(),
            type: 'saveDate',
            x: 0,
            y: 0,
            width: 260,
            height: 60,
            rotation: 0,
            zIndex: 1,
            locked: false,
            props: {
              title: 'Pesta',
              startAt: '2030-01-01T10:00:00.000Z',
              buttonLabel: 'Simpan tanggal',
            },
          },
        ])}
      />,
    )

    expect(screen.getByRole('link', { name: /simpan tanggal/i })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com'),
    )
  })
})
