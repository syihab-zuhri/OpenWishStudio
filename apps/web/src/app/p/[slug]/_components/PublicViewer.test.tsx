import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultDocument } from '@openwish/project-schema'
import { PublicViewer } from './PublicViewer'

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe('PublicViewer', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('keeps recipient chrome clean and shows only the watermark footer', () => {
    render(<PublicViewer document={createDefaultDocument('Untuk penerima')} />)

    expect(screen.getByRole('link', { name: 'Dibuat dengan OpenWish Studio' })).toBeVisible()
    expect(screen.queryByText('Laporkan halaman')).not.toBeInTheDocument()
    expect(screen.queryByText(/kedaluwarsa/i)).not.toBeInTheDocument()
  })
})
