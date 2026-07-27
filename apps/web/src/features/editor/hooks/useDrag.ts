'use client'

import { useCallback, useRef } from 'react'

export type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface DragStartPayload {
  elementId: string
  handle: DragHandle
  /** element geometry at drag start, in document coords */
  startX: number
  startY: number
  startW: number
  startH: number
}

interface UseDragOptions {
  zoom: number
  onCommit: (
    elementId: string,
    patch: { x?: number; y?: number; width?: number; height?: number },
    before: { x: number; y: number; width: number; height: number },
  ) => void
}

interface DragState extends DragStartPayload {
  pointerStartX: number
  pointerStartY: number
}

export function useDrag({ zoom, onCommit }: UseDragOptions) {
  const drag = useRef<DragState | null>(null)

  const startDrag = useCallback((e: React.PointerEvent, payload: DragStartPayload) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = {
      ...payload,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
    }
  }, [])

  const onPointerMove = useCallback(
    (
      e: React.PointerEvent,
      liveUpdate: (
        elementId: string,
        patch: { x?: number; y?: number; width?: number; height?: number },
      ) => void,
    ) => {
      const d = drag.current
      if (!d) return

      const dx = (e.clientX - d.pointerStartX) / zoom
      const dy = (e.clientY - d.pointerStartY) / zoom

      let patch: { x?: number; y?: number; width?: number; height?: number }

      if (d.handle === 'move') {
        patch = {
          x: Math.round(d.startX + dx),
          y: Math.round(d.startY + dy),
        }
      } else {
        // Corner resize
        const minW = 8
        const minH = 8
        let x = d.startX
        let y = d.startY
        let w = d.startW
        let h = d.startH

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

        patch = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }
      }

      liveUpdate(d.elementId, patch)
    },
    [zoom],
  )

  const onPointerUp = useCallback(
    // Signature kept parallel to onPointerMove so callers can pass the same
    // handler pair; the commit itself happens in the store, not here.
    (
      e: React.PointerEvent,
      _liveUpdate: (
        elementId: string,
        patch: { x?: number; y?: number; width?: number; height?: number },
      ) => void,
    ) => {
      const d = drag.current
      if (!d) return
      drag.current = null

      const dx = (e.clientX - d.pointerStartX) / zoom
      const dy = (e.clientY - d.pointerStartY) / zoom

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return

      let patch: { x?: number; y?: number; width?: number; height?: number }

      if (d.handle === 'move') {
        patch = { x: Math.round(d.startX + dx), y: Math.round(d.startY + dy) }
      } else {
        const minW = 8
        const minH = 8
        let x = d.startX,
          y = d.startY,
          w = d.startW,
          h = d.startH
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
        patch = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }
      }

      // Commit to history
      onCommit(d.elementId, patch, {
        x: d.startX,
        y: d.startY,
        width: d.startW,
        height: d.startH,
      })
    },
    [zoom, onCommit],
  )

  const isDragging = useCallback(() => drag.current !== null, [])

  return { startDrag, onPointerMove, onPointerUp, isDragging }
}
