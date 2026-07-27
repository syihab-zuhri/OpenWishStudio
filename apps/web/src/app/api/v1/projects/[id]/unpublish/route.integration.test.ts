import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createService: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/api/auth', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceClient: mocks.createService,
}))

import { POST } from './route'

beforeEach(() => {
  mocks.requireAuth.mockReset()
  mocks.createService.mockReset()
  mocks.rpc.mockReset()
  mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
  mocks.createService.mockResolvedValue({ rpc: mocks.rpc })
})

describe('POST project unpublish route', () => {
  it('maps the database moderator guard to a conflict response', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'disabled page' },
    })

    const response = await POST({} as NextRequest, {
      params: Promise.resolve({ id: 'project-1' }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('moderator') })
  })

  it('passes the authenticated actor and project to the atomic RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: 'unpublished', error: null })

    const response = await POST({} as NextRequest, {
      params: Promise.resolve({ id: 'project-1' }),
    })

    expect(mocks.rpc).toHaveBeenCalledWith('unpublish_project_atomic', {
      p_project_id: 'project-1',
      p_actor_id: 'user-1',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'unpublished' })
  })
})
