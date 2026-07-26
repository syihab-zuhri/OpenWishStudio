import { describe, it, expect } from 'vitest'
import { computeSnap } from './snapping'

const CANVAS = { width: 390, height: 844 }
const THRESHOLD = 6

describe('computeSnap', () => {
  it('snaps element center to canvas center', () => {
    // centerX = 160 + 40 = 200; garis tengah kanvas 195; delta 5 <= 6
    const result = computeSnap({ x: 160, y: 400, width: 80, height: 40 }, [], CANVAS, THRESHOLD)
    expect(result.x).toBe(155) // 195 - 80/2
    expect(result.guidesV).toEqual([195])
  })

  it('does not snap beyond the threshold', () => {
    // Titik acuan: kiri 100, tengah 140, kanan 180 — semua > 6px dari garis mana pun
    const result = computeSnap({ x: 100, y: 300, width: 80, height: 40 }, [], CANVAS, THRESHOLD)
    expect(result.x).toBe(100)
    expect(result.guidesV).toEqual([])
  })

  it('snaps left edge to canvas left edge', () => {
    const result = computeSnap({ x: 4, y: 300, width: 50, height: 50 }, [], CANVAS, THRESHOLD)
    expect(result.x).toBe(0)
    expect(result.guidesV).toEqual([0])
  })

  it('snaps top edge to canvas top', () => {
    const result = computeSnap({ x: 100, y: 5, width: 50, height: 50 }, [], CANVAS, THRESHOLD)
    expect(result.y).toBe(0)
    expect(result.guidesH).toEqual([0])
  })

  it('snaps to another element edge', () => {
    const other = { x: 20, y: 20, width: 100, height: 50 } // kanan = 120
    const result = computeSnap(
      { x: 124, y: 300, width: 60, height: 40 },
      [other],
      CANVAS,
      THRESHOLD,
    )
    expect(result.x).toBe(120)
    expect(result.guidesV).toEqual([120])
  })

  it('prefers the closest line when several are in range', () => {
    const other = { x: 100, y: 0, width: 10, height: 10 } // kanan = 110
    // Kandidat: 110 (delta 2) lebih dekat daripada 105 (tepi kiri other, delta 3? 108-105=3)
    const result = computeSnap({ x: 108, y: 300, width: 40, height: 40 }, [other], CANVAS, 6)
    expect(result.x).toBe(110)
  })

  it('keeps y untouched while snapping x only', () => {
    const result = computeSnap({ x: 4, y: 300, width: 50, height: 50 }, [], CANVAS, THRESHOLD)
    expect(result.y).toBe(300)
    expect(result.guidesH).toEqual([])
  })
})
