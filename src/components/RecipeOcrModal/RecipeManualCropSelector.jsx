import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Crop, Eye, Sparkles, Eraser, Plus } from 'lucide-react'

/**
 * Selector interactivo sobre la receta para recortar manualmente un renglón/estudio omitido
 * en la pestaña "Por Recortes", con superposición visual de los bloques ya detectados.
 */
export default function RecipeManualCropSelector({
  originalImageSrc,
  processedImageSrc,
  existingBoxes = [],
  isProcessing = false,
  onCancel,
  onConfirmCrop
}) {
  const canvasRef = useRef(null)
  const dragOriginRef = useRef(null)
  const dragDraftRef = useRef(null)

  const [displayMode, setDisplayMode] = useState('original') // 'original' | 'processed'
  const [loadedImgState, setLoadedImgState] = useState(null)
  const [selectionRect, setSelectionRect] = useState(null)
  const [dragDraft, setDragDraft] = useState(null)

  const activeSrc =
    displayMode === 'processed' && processedImageSrc ? processedImageSrc : originalImageSrc

  useEffect(() => {
    if (!activeSrc) return undefined
    let active = true
    const img = new Image()
    img.onload = () => {
      if (active) {
        setLoadedImgState({ src: activeSrc, img })
      }
    }
    img.src = activeSrc
    return () => {
      active = false
    }
  }, [activeSrc])

  const loadedImg = loadedImgState && loadedImgState.src === activeSrc ? loadedImgState.img : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !loadedImg || !loadedImg.naturalWidth || !loadedImg.naturalHeight) return

    const maxEditorDim = 820
    const scale = Math.min(
      1,
      maxEditorDim / Math.max(loadedImg.naturalWidth, loadedImg.naturalHeight)
    )
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

    // Marcar bloques ya detectados para ayudar a ubicar el faltante
    for (const box of existingBoxes) {
      if (!box) continue
      ctx.save()
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.7)'
      ctx.fillStyle = 'rgba(22, 163, 74, 0.08)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      const bx = box.x * cw
      const by = box.y * ch
      const bw = box.w * cw
      const bh = box.h * ch
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeRect(bx, by, bw, bh)
      ctx.restore()
    }

    const activeBox = dragDraft || selectionRect
    if (activeBox && activeBox.w > 0.005 && activeBox.h > 0.005) {
      const sx = activeBox.x * cw
      const sy = activeBox.y * ch
      const sw = activeBox.w * cw
      const sh = activeBox.h * ch

      ctx.save()
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'
      ctx.fillRect(0, 0, cw, sy)
      ctx.fillRect(0, sy + sh, cw, Math.max(0, ch - (sy + sh)))
      ctx.fillRect(0, sy, sx, sh)
      ctx.fillRect(sx + sw, sy, Math.max(0, cw - (sx + sw)), sh)

      ctx.strokeStyle = dragDraft ? '#0284c7' : '#2563eb'
      ctx.lineWidth = 2.5
      if (dragDraft) {
        ctx.setLineDash([6, 4])
      }
      ctx.strokeRect(sx, sy, sw, sh)
      ctx.restore()
    }
  }, [loadedImg, existingBoxes, selectionRect, dragDraft])

  const previewCropUrl = useMemo(() => {
    if (!loadedImg || !selectionRect || !loadedImg.naturalWidth || !loadedImg.naturalHeight) {
      return ''
    }
    const natW = loadedImg.naturalWidth
    const natH = loadedImg.naturalHeight
    const sx = Math.max(0, Math.round(selectionRect.x * natW))
    const sy = Math.max(0, Math.round(selectionRect.y * natH))
    const sw = Math.max(8, Math.min(natW - sx, Math.round(selectionRect.w * natW)))
    const sh = Math.max(8, Math.min(natH - sy, Math.round(selectionRect.h * natH)))

    const scale = Math.min(1, 760 / sw, 140 / sh)
    const destW = Math.max(8, Math.round(sw * scale))
    const destH = Math.max(8, Math.round(sh * scale))

    const out = document.createElement('canvas')
    out.width = destW
    out.height = destH
    const ctx = out.getContext('2d')
    if (!ctx) return ''

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, destW, destH)
    ctx.drawImage(loadedImg, sx, sy, sw, sh, 0, 0, destW, destH)
    return out.toDataURL('image/png')
  }, [loadedImg, selectionRect])

  const getNormalizedCoords = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }
  }

  const handlePointerDown = (e) => {
    if (isProcessing || !loadedImg) return
    const pt = getNormalizedCoords(e)
    if (!pt) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragOriginRef.current = pt
    const initialDraft = { x: pt.x, y: pt.y, w: 0, h: 0 }
    dragDraftRef.current = initialDraft
    setDragDraft(initialDraft)
  }

  const handlePointerMove = (e) => {
    const origin = dragOriginRef.current
    if (!origin) return
    const pt = getNormalizedCoords(e)
    if (!pt) return
    const nextDraft = {
      x: Math.min(origin.x, pt.x),
      y: Math.min(origin.y, pt.y),
      w: Math.abs(pt.x - origin.x),
      h: Math.abs(pt.y - origin.y)
    }
    dragDraftRef.current = nextDraft
    setDragDraft(nextDraft)
  }

  const finalizeDrag = (e) => {
    const origin = dragOriginRef.current
    if (!origin) return
    dragOriginRef.current = null
    e?.currentTarget?.releasePointerCapture?.(e.pointerId)

    const draft = dragDraftRef.current
    dragDraftRef.current = null
    setDragDraft(null)
    if (!draft) return

    if (draft.w >= 0.02 && draft.h >= 0.015) {
      setSelectionRect(draft)
    }
  }

  return (
    <div
      className="ocr-manual-crop"
      role="region"
      aria-label="Selector de recorte manual para agregar estudio faltante"
    >
      <div className="ocr-manual-crop__header">
        <div className="ocr-manual-crop__title-group">
          <Crop size={17} className="ocr-manual-crop__icon" />
          <div>
            <strong>Agregar recorte manual desde la receta</strong>
            <p className="ocr-manual-crop__desc">
              Arrastrá un rectángulo sobre el estudio o renglón que faltó (los recuadros verdes indican lo
              que ya fue detectado). Se ejecutará PaddleOCR local + comparador visual sobre ese fragmento.
            </p>
          </div>
        </div>
      </div>

      <div className="ocr-ai-editor__toolbar">
        {processedImageSrc && (
          <div className="ocr-ai-editor__tool-group">
            <button
              type="button"
              className={`ocr-ai-editor__tool-btn ${
                displayMode === 'original' ? 'ocr-ai-editor__tool-btn--active' : ''
              }`}
              onClick={() => setDisplayMode('original')}
              disabled={isProcessing}
            >
              <Eye size={13} />
              <span>Original</span>
            </button>
            <button
              type="button"
              className={`ocr-ai-editor__tool-btn ${
                displayMode === 'processed' ? 'ocr-ai-editor__tool-btn--active' : ''
              }`}
              onClick={() => setDisplayMode('processed')}
              disabled={isProcessing}
            >
              <Sparkles size={13} />
              <span>Contraste OCR</span>
            </button>
          </div>
        )}

        <div className="ocr-ai-editor__util-group">
          <button
            type="button"
            className="ocr-ai-editor__util-btn"
            onClick={() => setSelectionRect(null)}
            disabled={isProcessing || !selectionRect}
          >
            <Eraser size={13} />
            <span>Limpiar selección</span>
          </button>
        </div>
      </div>

      <div className="ocr-ai-editor__workspace">
        <div className="ocr-ai-editor__canvas-panel">
          <span className="ocr-ai-editor__panel-label">
            Dibujá el recuadro del estudio faltante
          </span>
          <div className="ocr-ai-editor__canvas-wrap">
            <canvas
              ref={canvasRef}
              className="ocr-ai-editor__canvas ocr-ai-editor__canvas--crop"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finalizeDrag}
              onPointerCancel={finalizeDrag}
            />
          </div>
        </div>

        <div className="ocr-ai-editor__preview-panel">
          <span className="ocr-ai-editor__panel-label">Vista previa del nuevo recorte</span>
          <div className="ocr-ai-editor__preview-box">
            {previewCropUrl ? (
              <img
                src={previewCropUrl}
                alt="Vista previa del recorte manual seleccionado"
                className="ocr-manual-crop__preview-img"
              />
            ) : (
              <span className="ocr-ai-editor__preview-empty">
                Arrastrá sobre la imagen para ver aquí el recorte seleccionado.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ocr-modal__privacy-guard-actions">
        <button
          type="button"
          className="ocr-modal__line-restore-btn"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="ocr-modal__manual-crop-confirm-btn"
          disabled={!selectionRect || isProcessing}
          onClick={() => selectionRect && onConfirmCrop(selectionRect)}
        >
          <Plus size={14} />
          <span>
            {isProcessing ? 'Analizando recorte...' : 'Agregar recorte y analizar'}
          </span>
        </button>
      </div>
    </div>
  )
}
