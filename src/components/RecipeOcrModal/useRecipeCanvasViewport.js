import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const MAX_EDITOR_DIM = 1400
export const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5, 3]

const MIN_CANVAS_DIM = 120
const FALLBACK_CONTAINER_WIDTH = 520
const FALLBACK_CONTAINER_HEIGHT = 400
const CONTAINER_SAFETY_MARGIN = 12

/**
 * Computes CSS display dimensions for the recipe canvas so it fits inside
 * the measured scroll container at zoom 1x without object-fit letterboxing,
 * and scales proportionally at higher zoom levels while preserving aspect ratio.
 */
export function computeCanvasDisplaySize(
  naturalWidth,
  naturalHeight,
  containerWidth,
  containerHeight,
  zoomFactor = 1
) {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return null
  }

  const availW =
    Number.isFinite(containerWidth) && containerWidth > 0
      ? containerWidth
      : FALLBACK_CONTAINER_WIDTH
  const availH =
    Number.isFinite(containerHeight) && containerHeight > 0
      ? containerHeight
      : FALLBACK_CONTAINER_HEIGHT

  const fitScale = Math.min(availW / naturalWidth, availH / naturalHeight)
  const safeZoom = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1

  const rawW = naturalWidth * fitScale * safeZoom
  const rawH = naturalHeight * fitScale * safeZoom

  if (rawW <= 0 || rawH <= 0) {
    return null
  }

  const clampScale = Math.max(1, MIN_CANVAS_DIM / rawW, MIN_CANVAS_DIM / rawH)

  return {
    width: Math.round(rawW * clampScale),
    height: Math.round(rawH * clampScale)
  }
}

/**
 * Maps a pointer/mouse event onto normalized [0, 1] canvas content coordinates,
 * compensating for any CSS border/scale on the canvas element.
 */
export function getCanvasNormalizedPoint(canvas, event) {
  if (!canvas || !event) return null
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null

  const rect = canvas.getBoundingClientRect()
  const offsetW = canvas.offsetWidth || rect.width
  const offsetH = canvas.offsetHeight || rect.height
  const borderX =
    canvas.offsetWidth && typeof canvas.clientWidth === 'number'
      ? canvas.offsetWidth - canvas.clientWidth
      : 0
  const borderY =
    canvas.offsetHeight && typeof canvas.clientHeight === 'number'
      ? canvas.offsetHeight - canvas.clientHeight
      : 0
  const scaleX = offsetW ? rect.width / offsetW : 1
  const scaleY = offsetH ? rect.height / offsetH : 1

  const contentLeft = rect.left + (canvas.clientLeft || 0) * scaleX
  const contentTop = rect.top + (canvas.clientTop || 0) * scaleY
  const contentWidth = rect.width - borderX * scaleX
  const contentHeight = rect.height - borderY * scaleY

  if (!contentWidth || !contentHeight || contentWidth <= 0 || contentHeight <= 0) {
    return null
  }

  return {
    x: Math.max(0, Math.min(1, (event.clientX - contentLeft) / contentWidth)),
    y: Math.max(0, Math.min(1, (event.clientY - contentTop) / contentHeight))
  }
}

/**
 * Shared viewport state and container measurement hook for recipe image editors.
 * Manages zoom steps, container ResizeObserver sizing, and fullscreen Escape handling.
 */
export function useRecipeCanvasViewport(loadedImg) {
  const wrapRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoomIndex, setZoomIndex] = useState(0)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined

    let rafId = 0

    const measure = () => {
      const style = window.getComputedStyle(el)
      const borderX =
        (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0)
      const borderY =
        (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
      const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      const innerW = el.offsetWidth - borderX - padX
      const innerH = el.offsetHeight - borderY - padY

      if (innerW <= 0 || innerH <= 0) return

      const nextW = Math.max(MIN_CANVAS_DIM, Math.floor(innerW - CONTAINER_SAFETY_MARGIN))
      const nextH = Math.max(MIN_CANVAS_DIM, Math.floor(innerH - CONTAINER_SAFETY_MARGIN))

      setContainerSize((prev) => {
        if (
          prev.width > 0 &&
          prev.height > 0 &&
          Math.abs(prev.width - nextW) <= 2 &&
          Math.abs(prev.height - nextH) <= 2
        ) {
          return prev
        }
        return prev.width === nextW && prev.height === nextH
          ? prev
          : { width: nextW, height: nextH }
      })
    }

    const scheduleMeasure = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        measure()
      })
    }

    el.scrollTop = 0
    el.scrollLeft = 0
    measure()
    scheduleMeasure()

    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleMeasure)
      observer.observe(el)
    } else {
      window.addEventListener('resize', scheduleMeasure)
    }

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      observer?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return undefined

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [isFullscreen])

  const zoomFactor = ZOOM_LEVELS[zoomIndex] ?? 1
  const zoomPercent = Math.round(zoomFactor * 100)
  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1
  const canZoomOut = zoomIndex > 0
  const isZoomed = zoomIndex > 0

  const zoomIn = useCallback(() => {
    setZoomIndex((idx) => Math.min(ZOOM_LEVELS.length - 1, idx + 1))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomIndex((idx) => Math.max(0, idx - 1))
  }, [])

  const resetZoom = useCallback(() => {
    setZoomIndex(0)
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
    setZoomIndex(0)
  }, [])

  const naturalWidth = loadedImg?.naturalWidth ?? 0
  const naturalHeight = loadedImg?.naturalHeight ?? 0

  const displaySize = useMemo(
    () =>
      computeCanvasDisplaySize(
        naturalWidth,
        naturalHeight,
        containerSize.width,
        containerSize.height,
        zoomFactor
      ),
    [naturalWidth, naturalHeight, containerSize.width, containerSize.height, zoomFactor]
  )

  return {
    wrapRef,
    displaySize,
    isFullscreen,
    setIsFullscreen,
    toggleFullscreen,
    zoomFactor,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    isZoomed,
    zoomIn,
    zoomOut,
    resetZoom
  }
}
