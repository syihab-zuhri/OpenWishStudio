export interface SnapRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SnapResult {
  x: number
  y: number
  /** Posisi garis panduan vertikal (koordinat desain) yang sedang aktif. */
  guidesV: number[]
  /** Posisi garis panduan horizontal yang sedang aktif. */
  guidesH: number[]
}

interface BestSnap {
  delta: number
  position: number
  line: number
}

function snapAxis(
  start: number,
  size: number,
  lines: Iterable<number>,
  threshold: number,
): BestSnap | null {
  let best: BestSnap | null = null
  // Tiga titik acuan pada elemen: tepi awal, tengah, tepi akhir
  const offsets = [0, size / 2, size]
  for (const line of lines) {
    for (const offset of offsets) {
      const delta = Math.abs(start + offset - line)
      if (delta <= threshold && (best === null || delta < best.delta)) {
        best = { delta, position: line - offset, line }
      }
    }
  }
  return best
}

/**
 * Snap posisi elemen yang sedang digeser ke garis bantu: tepi & tengah kanvas
 * serta tepi & tengah elemen lain. Semua nilai dalam koordinat desain (390-an);
 * threshold sudah dibagi zoom oleh pemanggil supaya terasa konsisten di layar.
 */
export function computeSnap(
  moving: SnapRect,
  others: SnapRect[],
  canvas: { width: number; height: number },
  threshold: number,
): SnapResult {
  const vLines = new Set<number>([0, canvas.width / 2, canvas.width])
  const hLines = new Set<number>([0, canvas.height / 2, canvas.height])
  for (const r of others) {
    vLines.add(r.x)
    vLines.add(r.x + r.width / 2)
    vLines.add(r.x + r.width)
    hLines.add(r.y)
    hLines.add(r.y + r.height / 2)
    hLines.add(r.y + r.height)
  }

  const bestX = snapAxis(moving.x, moving.width, vLines, threshold)
  const bestY = snapAxis(moving.y, moving.height, hLines, threshold)

  return {
    x: bestX ? Math.round(bestX.position) : moving.x,
    y: bestY ? Math.round(bestY.position) : moving.y,
    guidesV: bestX ? [bestX.line] : [],
    guidesH: bestY ? [bestY.line] : [],
  }
}
