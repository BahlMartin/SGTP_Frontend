import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Crop,
  Square,
  Undo2,
  Trash2,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from 'lucide-react'
import {
  MAX_EDITOR_DIM,
  getCanvasNormalizedPoint,
  useRecipeCanvasViewport
} from './useRecipeCanvasViewport'

const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 }

function buildSanitizedContextualDataUrl(img, cropRect, redactionBoxes) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return ''

  const natW = img.naturalWidth
  const natH = img.naturalHeight
  const sx = Math.max(0, Math.round(cropRect.x * natW))
  const sy = Math.max(0, Math.round(cropRect.y * natH))
  const sw = Math.max(16, Math.min(natW - sx, Math.round(cropRect.w * natW)))
  const sh = Math.max(16, Math.min(natH - sy, Math.round(cropRect.h * natH)))

  const scale = Math.min(1, 1280 / Math.max(sw, sh))
  const destW = Math.max(16, Math.round(sw * scale))
  const destH = Math.max(16, Math.round(sh * scale))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = destW
  outCanvas.height = destH
  const ctx = outCanvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, destW, destH)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH)

  ctx.fillStyle = '#ffffff'
  for (const box of redactionBoxes) {
    const rx = (box.x * natW - sx) * scale
    const ry = (box.y * natH - sy) * scale
    const rw = box.w * natW * scale
    const rh = box.h * natH * scale
    if (rw > 0 && rh > 0) {
      ctx.fillRect(rx, ry, rw, rh)
    }
  }

  return outCanvas.toDataURL('image/jpeg', 0.88)
}

export default function RecipeAiRedactionEditor({
  imageSrc,
  initialRedactionRects = [],
  isSubmitting = false,
  onCancel,
  onConfirm
}) {
  const canvasRef = useRef(null)
  const dragOriginRef = useRef(null)
  const dragDraftRef = useRef(null)
  const moveRafRef = useRef(null)

  const [loadedImgState, setLoadedImgState] = useState(null)
  const [tool, setTool] = useState('crop') // 'crop' | 'redact'
  const [cropRect, setCropRect] = useState(FULL_CROP)
  const [redactionBoxes, setRedactionBoxes] = useState(() =>
    Array.isArray(initialRedactionRects) ? initialRedactionRects : []
  )
  const [dragDraft, setDragDraft] = useState(null)

  useEffect(() => {
    if (!imageSrc) return undefined
    let active = true
    const img = new Image()
    img.onload = () => {
      if (active) {
        setLoadedImgState({ src: imageSrc, img })
      }
    }
    img.src = imageSrc
    return () => {
      active = false
    }
  }, [imageSrc])

  const loadedImg = loadedImgState && loadedImgState.src === imageSrc ? loadedImgState.img : null

  const {
    wrapRef,
    displaySize,
    isFullscreen,
    toggleFullscreen,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    isZoomed,
    zoomIn,
    zoomOut,
    resetZoom
  } = useRecipeCanvasViewport(loadedImg)

  const previewDataUrl = useMemo(
    () => buildSanitizedContextualDataUrl(loadedImg, cropRect, redactionBoxes),
    [loadedImg, cropRect, redactionBoxes]
  )

  // Render del lienzo interactivo (imagen original + cuadros blancos + sombreado fuera del recorte)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !loadedImg || !loadedImg.naturalWidth || !loadedImg.naturalHeight) return

    const scale = Math.min(1, MAX_EDITOR_DIM / Math.max(loadedImg.naturalWidth, loadedImg.naturalHeight))
    const cw = Math.max(120, Math.round(loadedImg.naturalWidth * scale))
    const ch = Math.max(120, Math.round(loadedImg.naturalHeight * scale))

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(loadedImg, 0, 0, cw, ch)

    // Cuadros blancos ya confirmados
    const confirmedBoxStroke = Math.max(1.5, cw / 520)
    for (const box of redactionBoxes) {
      const bx = box.x * cw
      const by = box.y * ch
      const bw = box.w * cw
      const bh = box.h * ch
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(bx, by, bw, bh)
      ctx.save()
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = confirmedBoxStroke
      ctx.setLineDash([4, 3])
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
    }

    // Borrador en vivo mientras arrastra
    if (dragDraft && dragDraft.w > 0.005 && dragDraft.h > 0.005) {
      const dx = dragDraft.x * cw
      const dy = dragDraft.y * ch
      const dw = dragDraft.w * cw
      const dh = dragDraft.h * ch
      const draftStroke = Math.max(2, cw / 420)

      if (tool === 'redact') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
        ctx.fillRect(dx, dy, dw, dh)
        ctx.save()
        ctx.strokeStyle = '#d97706'
        ctx.lineWidth = draftStroke
        ctx.setLineDash([5, 3])
        ctx.strokeRect(dx, dy, dw, dh)
        ctx.restore()
      } else {
        ctx.save()
        ctx.strokeStyle = '#dc2626'
        ctx.lineWidth = Math.max(2.5, cw / 340)
        ctx.setLineDash([8, 5])
        ctx.strokeRect(dx, dy, dw, dh)
        ctx.restore()
      }
    }

    // Resaltar área de recorte activa dejando sombreado lo excluido
    const cx = cropRect.x * cw
    const cy = cropRect.y * ch
    const crw = cropRect.w * cw
    const crh = cropRect.h * ch

    ctx.save()
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)'
    // Arriba
    ctx.fillRect(0, 0, cw, cy)
    // Abajo
    ctx.fillRect(0, cy + crh, cw, Math.max(0, ch - (cy + crh)))
    // Izquierda
    ctx.fillRect(0, cy, cx, crh)
    // Derecha
    ctx.fillRect(cx + crw, cy, Math.max(0, cw - (cx + crw)), crh)

    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = Math.max(2.5, cw / 340)
    ctx.setLineDash([8, 5])
    ctx.strokeRect(cx, cy, crw, crh)
    ctx.restore()
  }, [loadedImg, cropRect, redactionBoxes, dragDraft, tool, isFullscreen])

  useEffect(() => {
    return () => {
      if (moveRafRef.current) {
        window.cancelAnimationFrame(moveRafRef.current)
        moveRafRef.current = null
      }
    }
  }, [])

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (isSubmitting || !loadedImg) return
    const pt = getCanvasNormalizedPoint(canvasRef.current, e)
    if (!pt) return
    if (moveRafRef.current) {
      window.cancelAnimationFrame(moveRafRef.current)
      moveRafRef.current = null
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragOriginRef.current = pt
    const initialDraft = { x: pt.x, y: pt.y, w: 0, h: 0 }
    dragDraftRef.current = initialDraft
    setDragDraft(initialDraft)
  }

  const handlePointerMove = (e) => {
    const origin = dragOriginRef.current
    if (!origin) return
    const pt = getCanvasNormalizedPoint(canvasRef.current, e)
    if (!pt) return
    const x = Math.min(origin.x, pt.x)
    const y = Math.min(origin.y, pt.y)
    const w = Math.abs(pt.x - origin.x)
    const h = Math.abs(pt.y - origin.y)
    const nextDraft = { x, y, w, h }
    dragDraftRef.current = nextDraft
    if (!moveRafRef.current) {
      moveRafRef.current = window.requestAnimationFrame(() => {
        moveRafRef.current = null
        if (dragDraftRef.current) {
          setDragDraft(dragDraftRef.current)
        }
      })
    }
  }

  const finalizeDrag = (e) => {
    const origin = dragOriginRef.current
    if (!origin) return
    dragOriginRef.current = null
    if (moveRafRef.current) {
      window.cancelAnimationFrame(moveRafRef.current)
      moveRafRef.current = null
    }
    e?.currentTarget?.releasePointerCapture?.(e.pointerId)

    const draft = dragDraftRef.current
    dragDraftRef.current = null
    setDragDraft(null)
    if (!draft) return

    if (tool === 'crop') {
      if (draft.w >= 0.06 && draft.h >= 0.06) {
        setCropRect(draft)
      }
    } else if (draft.w >= 0.015 && draft.h >= 0.012) {
      setRedactionBoxes((prev) => [...prev, draft])
    }
  }

  const isFullCrop =
    cropRect.x === 0 && cropRect.y === 0 && cropRect.w === 1 && cropRect.h === 1

  const handleConfirmClick = () => {
    if (!loadedImg || isSubmitting) return
    const finalUrl =
      previewDataUrl || buildSanitizedContextualDataUrl(loadedImg, cropRect, redactionBoxes)
    if (finalUrl) {
      onConfirm(finalUrl)
    }
  }

  const editorContent = (
    <div
      className={`ocr-ai-editor${isFullscreen ? ' ocr-ai-editor--fullscreen' : ''}`}
      role="region"
      aria-label="Editor de privacidad contextual para Gemini"
    >
      <div className="ocr-modal__privacy-guard-header">
        <ShieldAlert size={18} className="ocr-modal__privacy-guard-icon" />
        <div>
          <strong>Preparar imagen en contexto para Gemini IA</strong>
          <p className="ocr-modal__privacy-guard-desc">
            Recortá para dejar solo la zona clínica (diagnóstico, estudios e indicaciones de muestra) y tapá
            con cuadros blancos la firma, el sello o cualquier dato sensible del paciente antes de enviar.
          </p>
        </div>
      </div>

      <div className="ocr-ai-editor__toolbar">
        <div className="ocr-ai-editor__tool-group">
          <button
            type="button"
            className={`ocr-ai-editor__tool-btn ${tool === 'crop' ? 'ocr-ai-editor__tool-btn--active' : ''}`}
            onClick={() => setTool('crop')}
            disabled={isSubmitting}
          >
            <Crop size={14} />
            <span>1. Recortar zona clínica</span>
          </button>
          <button
            type="button"
            className={`ocr-ai-editor__tool-btn ${tool === 'redact' ? 'ocr-ai-editor__tool-btn--active' : ''}`}
            onClick={() => setTool('redact')}
            disabled={isSubmitting}
          >
            <Square size={14} />
            <span>2. Tapar firma / datos sensibles</span>
          </button>
        </div>

        <div className="ocr-ai-editor__util-group">
          <button
            type="button"
            className="ocr-ai-editor__util-btn"
            onClick={() => setRedactionBoxes((prev) => prev.slice(0, -1))}
            disabled={isSubmitting || redactionBoxes.length === 0}
            title="Deshacer el último rectángulo blanco"
          >
            <Undo2 size={13} />
            <span>Deshacer cuadro ({redactionBoxes.length})</span>
          </button>
          <button
            type="button"
            className="ocr-ai-editor__util-btn"
            onClick={() => setRedactionBoxes([])}
            disabled={isSubmitting || redactionBoxes.length === 0}
            title="Quitar todos los rectángulos blancos"
          >
            <Trash2 size={13} />
            <span>Limpiar cuadros</span>
          </button>
          <button
            type="button"
            className="ocr-ai-editor__util-btn"
            onClick={() => setCropRect(FULL_CROP)}
            disabled={isSubmitting || isFullCrop}
            title="Volver al recorte completo de la foto"
          >
            <RotateCcw size={13} />
            <span>Restablecer recorte</span>
          </button>
        </div>

        <div className="ocr-ai-editor__viewport-controls">
          <button
            type="button"
            className="ocr-ai-editor__zoom-btn"
            onClick={zoomOut}
            disabled={!loadedImg || !canZoomOut}
            aria-label="Alejar imagen"
            title="Alejar"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            className="ocr-ai-editor__zoom-reset-btn"
            onClick={resetZoom}
            disabled={!loadedImg || !isZoomed}
            title="Ajustar al contenedor"
          >
            {isZoomed ? `${zoomPercent}% · Ajustar` : `${zoomPercent}%`}
          </button>
          <button
            type="button"
            className="ocr-ai-editor__zoom-btn"
            onClick={zoomIn}
            disabled={!loadedImg || !canZoomIn}
            aria-label="Acercar imagen"
            title="Acercar"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            className="ocr-ai-editor__fullscreen-btn"
            onClick={toggleFullscreen}
            disabled={isSubmitting}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</span>
          </button>
        </div>
      </div>

      <p className="ocr-ai-editor__hint">
        {tool === 'crop'
          ? 'Modo Recorte activo: arrastrá un rectángulo sobre diagnóstico y estudios (dejando fuera Nombre, DNI y Obra Social).'
          : 'Modo Tapado blanco activo: arrastrá sobre firma, sello médico o datos sensibles para cubrirlos con un cuadro blanco sólido.'}
      </p>

      <div className="ocr-ai-editor__workspace">
        <div className="ocr-ai-editor__canvas-panel">
          <span className="ocr-ai-editor__panel-label">Editor sobre receta original</span>
          <div
            ref={wrapRef}
            className={`ocr-ai-editor__canvas-wrap${!isZoomed ? ' ocr-ai-editor__canvas-wrap--fit' : ''}`}
          >
            <div className="ocr-ai-editor__canvas-stage">
              <canvas
                ref={canvasRef}
                className={`ocr-ai-editor__canvas ${
                  tool === 'crop' ? 'ocr-ai-editor__canvas--crop' : 'ocr-ai-editor__canvas--redact'
                }`}
                style={
                  displaySize
                    ? { width: `${displaySize.width}px`, height: `${displaySize.height}px` }
                    : undefined
                }
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finalizeDrag}
                onPointerCancel={finalizeDrag}
              />
            </div>
          </div>
        </div>

        <div className="ocr-ai-editor__preview-panel">
          <span className="ocr-ai-editor__panel-label">
            Vista previa exacta que recibirá Gemini
          </span>
          <div className="ocr-ai-editor__preview-box">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Vista previa saneada para enviar a Gemini"
                className="ocr-ai-editor__preview-img"
              />
            ) : (
              <span className="ocr-ai-editor__preview-empty">Generando vista previa...</span>
            )}
          </div>
        </div>
      </div>

      <div className="ocr-modal__privacy-guard-actions">
        <button
          type="button"
          className="ocr-modal__line-restore-btn"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="ocr-modal__ai-batch-btn"
          disabled={!loadedImg || isSubmitting}
          onClick={handleConfirmClick}
        >
          <Sparkles size={14} />
          <span>
            {isSubmitting
              ? 'Consultando Gemini IA...'
              : 'Confirmar y Enviar a Gemini IA'}
          </span>
        </button>
      </div>
    </div>
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div className="ocr-ai-editor__fullscreen-backdrop">
        <div
          className="ocr-ai-editor__fullscreen-dialog ocr-ai-editor__fullscreen-dialog--privacy"
          role="dialog"
          aria-modal="true"
          aria-label="Editor de privacidad IA en pantalla completa"
        >
          {editorContent}
        </div>
      </div>,
      document.body
    )
  }

  return editorContent
}
