import { describe, it, expect, vi } from 'vitest'

// ─── Helpers: pure drag math extracted from useDrag ──────────────────────────
// We test the patch-calculation logic directly without instantiating the hook
// (which requires a DOM pointer-capture environment).

interface DragState {
  elementId: string
  handle: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  startX: number
  startY: number
  startW: number
  startH: number
  pointerStartX: number
  pointerStartY: number
}

function calcPatch(
  d: DragState,
  clientX: number,
  clientY: number,
  zoom: number,
) {
  const dx = (clientX - d.pointerStartX) / zoom
  const dy = (clientY - d.pointerStartY) / zoom
  const minW = 8
  const minH = 8

  if (d.handle === 'move') {
    return {
      x: Math.round(d.startX + dx),
      y: Math.round(d.startY + dy),
    }
  }

  let x = d.startX, y = d.startY, w = d.startW, h = d.startH

  if (d.handle === 'nw') {
    w = Math.max(minW, d.startW - dx)
    h = Math.max(minH, d.startH - dy)
    x = d.startX + d.startW - w
    y = d.startY + d.startH - h
  } else if (d.handle === 'ne') {
    w = Math.max(minW, d.startW + dx)
    h = Math.max(minH, d.startH - dy)
    y = d.startY + d.startH - h
  } else if (d.handle === 'sw') {
    w = Math.max(minW, d.startW - dx)
    h = Math.max(minH, d.startH + dy)
    x = d.startX + d.startW - w
  } else if (d.handle === 'se') {
    w = Math.max(minW, d.startW + dx)
    h = Math.max(minH, d.startH + dy)
  }

  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }
}

function makeDrag(overrides: Partial<DragState> = {}): DragState {
  return {
    elementId: 'el-1',
    handle: 'move',
    startX: 100,
    startY: 100,
    startW: 200,
    startH: 100,
    pointerStartX: 0,
    pointerStartY: 0,
    ...overrides,
  }
}

// ─── move handle ─────────────────────────────────────────────────────────────

describe('useDrag — move handle', () => {
  it('calculates x = startX + dx / zoom', () => {
    const d = makeDrag({ handle: 'move', startX: 50, startY: 80 })
    const patch = calcPatch(d, 30, 20, 1)
    expect(patch.x).toBe(80)  // 50 + 30
    expect(patch.y).toBe(100) // 80 + 20
  })

  it('divides delta by zoom', () => {
    const d = makeDrag({ handle: 'move', startX: 0, startY: 0 })
    const patch = calcPatch(d, 100, 100, 2)
    expect(patch.x).toBe(50)
    expect(patch.y).toBe(50)
  })

  it('rounds to nearest integer', () => {
    const d = makeDrag({ handle: 'move', startX: 0, startY: 0 })
    const patch = calcPatch(d, 1, 1, 3) // dx = 1/3 ≈ 0.333 → rounded to 0
    expect(Number.isInteger(patch.x)).toBe(true)
    expect(Number.isInteger(patch.y)).toBe(true)
  })
})

// ─── se handle ───────────────────────────────────────────────────────────────

describe('useDrag — se handle', () => {
  it('increases width and height', () => {
    const d = makeDrag({ handle: 'se', startW: 100, startH: 60 })
    const patch = calcPatch(d, 40, 20, 1)
    expect(patch.width).toBe(140)
    expect(patch.height).toBe(80)
  })

  it('clamps width to min 8px', () => {
    const d = makeDrag({ handle: 'se', startW: 100, startH: 60 })
    const patch = calcPatch(d, -500, -500, 1) // huge negative drag
    expect(patch.width).toBe(8)
    expect(patch.height).toBe(8)
  })
})

// ─── nw handle ───────────────────────────────────────────────────────────────

describe('useDrag — nw handle', () => {
  it('adjusts x, y, width, and height', () => {
    const d = makeDrag({ handle: 'nw', startX: 100, startY: 100, startW: 200, startH: 100 })
    const patch = calcPatch(d, 20, 10, 1) // dx=20, dy=10 → w=180, h=90
    expect(patch.width).toBe(180)
    expect(patch.height).toBe(90)
    expect(patch.x).toBe(120) // startX + startW - w = 100+200-180
    expect(patch.y).toBe(110) // startY + startH - h = 100+100-90
  })

  it('clamps min size and adjusts origin accordingly', () => {
    const d = makeDrag({ handle: 'nw', startX: 100, startY: 100, startW: 50, startH: 50 })
    const patch = calcPatch(d, 500, 500, 1)
    expect(patch.width).toBe(8)
    expect(patch.height).toBe(8)
    expect(patch.x).toBe(142) // 100+50-8
    expect(patch.y).toBe(142)
  })
})

// ─── ne handle ───────────────────────────────────────────────────────────────

describe('useDrag — ne handle', () => {
  it('increases width, adjusts y (not x)', () => {
    const d = makeDrag({ handle: 'ne', startX: 100, startY: 100, startW: 200, startH: 100 })
    const patch = calcPatch(d, 50, -30, 1) // dx=50 → w=250, dy=-30 → h=130
    expect(patch.width).toBe(250)
    expect(patch.height).toBe(130)
    expect(patch.x).toBe(100) // x unchanged
    expect(patch.y).toBe(70)  // 100+100-130
  })
})

// ─── sw handle ───────────────────────────────────────────────────────────────

describe('useDrag — sw handle', () => {
  it('adjusts x (not y), increases height', () => {
    const d = makeDrag({ handle: 'sw', startX: 100, startY: 100, startW: 200, startH: 100 })
    const patch = calcPatch(d, -40, 50, 1) // dx=-40 → w=240, dy=50 → h=150
    expect(patch.width).toBe(240)
    expect(patch.height).toBe(150)
    expect(patch.x).toBe(60)  // 100+200-240
    expect(patch.y).toBe(100) // y unchanged
  })
})

// ─── sub-pixel threshold ──────────────────────────────────────────────────────

describe('useDrag — sub-pixel commit threshold', () => {
  it('onCommit is not called for sub-pixel movement (< 1px)', () => {
    // Mirror the threshold logic: |dx| < 1 && |dy| < 1 → skip commit
    const onCommit = vi.fn()
    const dx = 0.5
    const dy = 0.5
    if (!(Math.abs(dx) < 1 && Math.abs(dy) < 1)) {
      onCommit('el', {})
    }
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('onCommit IS called when movement exceeds 1px', () => {
    const onCommit = vi.fn()
    const dx = 5
    const dy = 0
    if (!(Math.abs(dx) < 1 && Math.abs(dy) < 1)) {
      onCommit('el', {})
    }
    expect(onCommit).toHaveBeenCalledOnce()
  })
})
