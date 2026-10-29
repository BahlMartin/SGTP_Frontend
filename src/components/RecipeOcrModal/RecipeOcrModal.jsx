import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Upload,
  Check,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ClipboardPaste,
  Eye,
  SlidersHorizontal,
  Plus
} from 'lucide-react'
import { processRecipeFullFlow, reportOcrFeedbackApi } from '../../services/ocrService'
import './RecipeOcrModal.css'

export default function RecipeOcrModal({ onClose, onConfirmStudies }) {
  // Estados de captura de imagen
  const [file, setFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [viewMode, setViewMode] = useState('original') // 'original' | 'processed'

  // Estados de Procesamiento OCR
  const [analyzing, setAnalyzing] = useState(false)
  const [progressInfo, setProgressInfo] = useState({ percent: 0, message: '' })
  const [ocrError, setOcrError] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [selectedStudies, setSelectedStudies] = useState([])
  const [showFloatingAlert, setShowFloatingAlert] = useState(false)

  // Manejar subida o selección de archivo
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setImagePreview(URL.createObjectURL(selected))
      setOcrError(null)
    }
  }

  // Escuchar evento Paste (Ctrl + V) desde portapapeles o escáner
  const handlePasteEvent = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const pastedBlob = item.getAsFile()
        if (pastedBlob) {
          e.preventDefault()
          const pastedFile = new File([pastedBlob], 'escaneo_portapapeles.png', { type: item.type })
          setFile(pastedFile)
          setImagePreview(URL.createObjectURL(pastedBlob))
          setOcrError(null)
          break
        }
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('paste', handlePasteEvent)
    return () => {
      window.removeEventListener('paste', handlePasteEvent)
    }
  }, [handlePasteEvent])

  // Auto-ocultar la alerta flotante luego de unos segundos para despejar la vista en móvil
  useEffect(() => {
    if (!showFloatingAlert) return
    const timer = setTimeout(() => {
      setShowFloatingAlert(false)
    }, 4500)
    return () => clearTimeout(timer)
  }, [showFloatingAlert])

  // Iniciar procesamiento completo con PaddleOCR PP-OCRv5 -> Django Mapeo
  const handleProcessOcr = async () => {
    if (!file && !imagePreview) return
    setAnalyzing(true)
    setOcrError(null)
    setProgressInfo({ percent: 10, message: 'Inicializando red neuronal PaddleOCR...' })

    try {
      const source = file || imagePreview
      const res = await processRecipeFullFlow(source, (progress) => {
        setProgressInfo(progress)
      })

      setOcrResult(res)
      setSelectedStudies(res.suggestedStudies || [])
      setShowFloatingAlert(true)
    } catch (err) {
      console.error('Error al procesar receta OCR:', err)
      setOcrError(err.message || 'No se pudo procesar la receta médica.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Alternar selección de un estudio
  const toggleStudy = (study) => {
    setSelectedStudies((prev) =>
      prev.some((s) => s.id === study.id)
        ? prev.filter((s) => s.id !== study.id)
        : [...prev, study]
    )
  }

  const handleConfirm = () => {
    // Disparar retroalimentación de aprendizaje activo en segundo plano (fire-and-forget)
    if (ocrResult?.detectedLines?.length > 0 && selectedStudies.length > 0) {
      const asociacionesDirectas = selectedStudies
        .filter(
          (s) =>
            s.textoOrigen &&
            s.textoOrigen !== 'Agregado manualmente' &&
            s.textoOrigen !== 'Sugerencia contextual'
        )
        .map((s) => ({
          texto: s.textoOrigen,
          estudioId: s.id
        }))

      reportOcrFeedbackApi({
        lineasOrigen: ocrResult.detectedLines,
        estudiosConfirmadosIds: selectedStudies.map((s) => s.id),
        asociacionesDirectas
      }).catch((err) => {
        console.warn('Feedback OCR no crítico falló:', err)
      })
    }

    onConfirmStudies(selectedStudies)
    onClose()
  }

  // Estudios mostrados en la grilla: combina los sugeridos por OCR + los agregados desde sugerencias contextuales
  // para que si el usuario agrega una sugerencia contextual, aparezca en la grilla y pueda desmarcarla si se equivocó.
  const displayedStudies = useMemo(() => {
    const baseStudies = ocrResult?.suggestedStudies || []
    const baseIds = new Set(baseStudies.map((s) => s.id))
    const addedContextualStudies = selectedStudies.filter((s) => !baseIds.has(s.id))
    return [...baseStudies, ...addedContextualStudies]
  }, [ocrResult, selectedStudies])

  return (
    <div className="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title">
      <div className={`ocr-modal__card ${ocrResult ? 'ocr-modal__card--review' : ''}`}>
        <button
          className="ocr-modal__close-btn"
          onClick={onClose}
          aria-label="Cerrar ventana de escaneo"
        >
          <X size={20} />
        </button>

        {/* Alerta Flotante (Toast) de Prácticas Reconocidas */}
        {ocrResult && showFloatingAlert && (
          <div className="ocr-modal__floating-toast" role="status">
            <Check size={15} className="ocr-modal__alert-icon" />
            <div className="ocr-modal__alert-content">
              {ocrResult.totalSugerencias > 0 ? (
                <>
                  <strong>{ocrResult.totalSugerencias} prácticas reconocidas</strong>
                  <span className="ocr-modal__alert-subtext">
                    — Valide las selecciones
                  </span>
                </>
              ) : (
                <span>No se detectaron estudios coincidentes automáticamente.</span>
              )}
            </div>
            <button
              type="button"
              className="ocr-modal__toast-close"
              onClick={() => setShowFloatingAlert(false)}
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="ocr-modal__header">
          <div className="ocr-modal__chip-ai">
            <Sparkles size={16} />
            <span>OCR Inteligente (PaddleOCR PP-OCRv5)</span>
          </div>
          <h3 id="ocr-modal-title" className="ocr-modal__title">
            Escaneo y Reconocimiento de Receta Médica
          </h3>
          <p className="ocr-modal__subtitle">
            Procesamiento neuronal 100% en memoria de la PC local (Privacidad PHI). Detección por polígonos libres (DBNet) y lectura profunda (SVTR).
          </p>
        </div>

        {ocrError && (
          <div className="ocr-modal__error-alert">
            <AlertCircle size={18} />
            <span>{ocrError}</span>
          </div>
        )}

        {!ocrResult ? (
          <div className="ocr-modal__step-upload">
            <div className="ocr-modal__upload-body">
              {imagePreview ? (
                <div className="ocr-modal__preview-container">
                  <img src={imagePreview} alt="Receta médica cargada" className="ocr-modal__preview-image" />
                  <button
                    type="button"
                    className="ocr-modal__reupload-btn"
                    onClick={() => {
                      setImagePreview(null)
                      setFile(null)
                    }}
                  >
                    <RefreshCw size={14} />
                    Cambiar o volver a cargar imagen
                  </button>
                </div>
              ) : (
                <div className="ocr-modal__dropzone">
                  <ClipboardPaste size={42} className="ocr-modal__dropzone-icon" />
                  <p className="ocr-modal__dropzone-text">
                    <strong>Arrastre una foto</strong> de la receta, selecciónela de su equipo o presione{' '}
                    <kbd className="ocr-modal__kbd">Ctrl + V</kbd> si su escáner copió la imagen al portapapeles.
                  </p>
                  <div className="ocr-modal__dropzone-buttons">
                    <label className="ocr-modal__browse-btn">
                      <Upload size={16} />
                      Seleccionar Archivo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Barra de Progreso Dinámica */}
              {analyzing && (
                <div className="ocr-modal__progress-box">
                  <div className="ocr-modal__progress-header">
                    <span className="ocr-modal__progress-label">{progressInfo.message}</span>
                    <span className="ocr-modal__progress-value">{progressInfo.percent}%</span>
                  </div>
                  <div className="ocr-modal__progress-bar-track">
                    <div
                      className="ocr-modal__progress-bar-fill"
                      style={{ width: `${Math.max(5, progressInfo.percent)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Acciones de la fase de captura (Footer fijo) */}
            <div className="ocr-modal__actions">
              <button
                type="button"
                className="ocr-modal__run-btn"
                disabled={!imagePreview || analyzing}
                onClick={handleProcessOcr}
              >
                {analyzing ? (
                  <>
                    <span className="ocr-modal__spinner" />
                    Procesando receta con PaddleOCR...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Procesar y Extraer Prácticas Solicitadas
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Vista de Revisión Human-in-the-Loop (Split-View en Desktop / Scroll Único en Móvil) */
          <div className="ocr-modal__step-review">
            <div className="ocr-modal__review-body">
              {/* Panel Izquierdo: Inspección visual de receta y metadatos */}
              <aside className="ocr-modal__sidebar">
                <div className="ocr-modal__review-preview">
                  <div className="ocr-modal__review-image-wrapper">
                    <img
                      src={viewMode === 'processed' && ocrResult.preprocessedDataUrl ? ocrResult.preprocessedDataUrl : imagePreview}
                      alt="Vista de la orden"
                      className="ocr-modal__review-thumbnail"
                    />
                  </div>

                  <div className="ocr-modal__sidebar-controls">
                    {/* Alternar vista de imagen original vs realzada */}
                    {ocrResult.preprocessedDataUrl && (
                      <div className="ocr-modal__view-toggle">
                        <span className="ocr-modal__toggle-label">
                          <SlidersHorizontal size={13} /> Filtro:
                        </span>
                        <button
                          type="button"
                          className={`ocr-modal__toggle-btn ${viewMode === 'original' ? 'ocr-modal__toggle-btn--active' : ''}`}
                          onClick={() => setViewMode('original')}
                        >
                          <Eye size={13} /> Original
                        </button>
                        <button
                          type="button"
                          className={`ocr-modal__toggle-btn ${viewMode === 'processed' ? 'ocr-modal__toggle-btn--active' : ''}`}
                          onClick={() => setViewMode('processed')}
                        >
                          <Sparkles size={13} /> Contraste
                        </button>
                      </div>
                    )}

                    <div className="ocr-modal__review-info">
                      <span className="ocr-modal__info-chip">
                        Líneas leídas: {ocrResult.detectedLines?.length || 0}
                      </span>
                      {ocrResult.confidence > 0 && (
                        <span className="ocr-modal__info-chip">
                          Confianza: {Math.round(ocrResult.confidence)}%
                        </span>
                      )}
                      {ocrResult.engineUsed && (
                        <span className="ocr-modal__info-chip ocr-modal__info-chip--engine">
                          {ocrResult.engineUsed}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banner de Combo o Batería de Rutina detectada (compacto) */}
                {ocrResult.comboDetectado && (
                  <div className="ocr-modal__combo-banner">
                    <div className="ocr-modal__combo-header">
                      <span className="ocr-modal__combo-badge">📦 Combo</span>
                      <strong className="ocr-modal__combo-title">{ocrResult.comboDetectado}</strong>
                    </div>
                    <p className="ocr-modal__combo-desc">
                      Prácticas del perfil preseleccionadas automáticamente.
                    </p>
                  </div>
                )}
              </aside>

              {/* Panel Derecho: Lista de estudios y sugerencias contextuales */}
              <div className="ocr-modal__main-panel">
                {/* Alerta estática visible en Desktop; en móvil usa el Toast Flotante para no tapar la imagen/confianza */}
                <div className="ocr-modal__alert ocr-modal__alert--desktop">
                  <Check size={15} className="ocr-modal__alert-icon" />
                  <div className="ocr-modal__alert-content">
                    {ocrResult.totalSugerencias > 0 ? (
                      <>
                        <strong>{ocrResult.totalSugerencias} prácticas reconocidas</strong>
                        <span className="ocr-modal__alert-subtext">
                          — Valide las selecciones antes de confirmar
                        </span>
                      </>
                    ) : (
                      <span>No se detectaron estudios coincidentes automáticamente.</span>
                    )}
                  </div>
                </div>

                {/* Grilla de Prácticas Detectadas + Agregadas (2 columnas en PC, 1 en móvil, sin scroll anidado) */}
                {displayedStudies.length > 0 ? (
                  <div className="ocr-modal__studies-grid">
                    {displayedStudies.map((study) => {
                      const isSelected = selectedStudies.some((s) => s.id === study.id)
                      const scoreNumber = Number(study.score) || 0

                      return (
                        <label
                          key={study.id}
                          className={`ocr-modal__study-item ${isSelected ? 'ocr-modal__study-item--selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="ocr-modal__study-checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudy(study)}
                          />
                          <div className="ocr-modal__study-details">
                            <span className="ocr-modal__study-name">{study.nombre}</span>
                            <div className="ocr-modal__study-meta">
                              {study.codigoPractica && (
                                <span className="ocr-modal__study-code">{study.codigoPractica}</span>
                              )}
                              {study.origenDeteccion !== 'VALIDADO_POR_CONTEXTO' && (
                                <span className="ocr-modal__motor-badge ocr-modal__motor-badge--paddle">
                                  🎯 PaddleOCR
                                </span>
                              )}
                              {study.origenDeteccion === 'COMBO_RUTINA' ? (
                                <span className="ocr-modal__origin-badge ocr-modal__origin-badge--combo">
                                  Combo de Rutina
                                </span>
                              ) : study.origenDeteccion === 'MEMORIA_APRENDIDA' ? (
                                <span className="ocr-modal__origin-badge ocr-modal__origin-badge--memory">
                                  Memoria del equipo
                                </span>
                              ) : study.origenDeteccion === 'VALIDADO_POR_CONTEXTO' ? (
                                <span className="ocr-modal__origin-badge ocr-modal__origin-badge--context">
                                  ✨ Agregado por sugerencia
                                </span>
                              ) : scoreNumber > 0 ? (
                                <span
                                  className={`ocr-modal__study-score ${
                                    scoreNumber >= 85 ? 'ocr-modal__study-score--high' : 'ocr-modal__study-score--medium'
                                  }`}
                                >
                                  {scoreNumber}% coincidencia
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="ocr-modal__no-studies-msg">
                    <AlertCircle size={16} />
                    <span>
                      No se identificaron prácticas automáticamente con PaddleOCR en la imagen cargada.
                    </span>
                  </div>
                )}

                {/* Sugerencias contextuales de estudios co-ocurrentes */}
                {ocrResult.sugerenciasContextuales?.length > 0 && (() => {
                  const visibleSuggestions = ocrResult.sugerenciasContextuales.filter(
                    (sug) => !selectedStudies.some((s) => s.id === sug.id_estudio)
                  )
                  if (visibleSuggestions.length === 0) return null

                  return (
                    <div className="ocr-modal__contextual-box">
                      <div className="ocr-modal__contextual-header">
                        <Sparkles size={14} className="ocr-modal__contextual-icon" />
                        <span>Prácticas solicitadas habitualmente en conjunto:</span>
                      </div>
                      <div className="ocr-modal__contextual-chips">
                        {visibleSuggestions.map((sug) => (
                          <button
                            key={sug.id_estudio}
                            type="button"
                            className="ocr-modal__contextual-chip"
                            title={sug.motivo || 'Estudio frecuente en este combo'}
                            onClick={() => {
                              setSelectedStudies((prev) => [
                                ...prev,
                                {
                                  id: sug.id_estudio,
                                  nombre: sug.nombre,
                                  categoria: 'Sugerencia Contextual',
                                  codigoPractica: sug.codigo_practica || '',
                                  score: Math.round((sug.indice_afinidad || 0.8) * 100),
                                  textoOrigen: 'Sugerencia contextual',
                                  origenDeteccion: 'VALIDADO_POR_CONTEXTO'
                                }
                              ])
                            }}
                          >
                            <Plus size={13} />
                            <span>{sug.nombre}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Acciones finales (Footer fijo siempre visible) */}
            <div className="ocr-modal__actions">
              <button
                type="button"
                className="ocr-modal__cancel-btn"
                onClick={() => {
                  setOcrResult(null)
                  setShowFloatingAlert(false)
                  setProgressInfo({ percent: 0, message: '' })
                }}
              >
                Volver a Cargar
              </button>
              <button
                type="button"
                className="ocr-modal__confirm-btn"
                onClick={handleConfirm}
                disabled={selectedStudies.length === 0}
              >
                Confirmar Estudios ({selectedStudies.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
