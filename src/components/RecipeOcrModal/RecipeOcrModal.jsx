import React, { useState, useEffect, useCallback } from 'react'
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

  // Estudios sugeridos identificados por PaddleOCR
  const displayedStudies = ocrResult?.suggestedStudies || []

  return (
    <div className="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title">
      <div className="ocr-modal__card">
        <button
          className="ocr-modal__close-btn"
          onClick={onClose}
          aria-label="Cerrar ventana de escaneo"
        >
          <X size={20} />
        </button>

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

            {/* Acciones de la fase de captura */}
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
          /* Vista de Revisión Human-in-the-Loop */
          <div className="ocr-modal__step-review">
            <div className="ocr-modal__alert">
              <Check size={18} className="ocr-modal__alert-icon" />
              <div className="ocr-modal__alert-content">
                <strong>Revisión Asistida de Prácticas (Human-in-the-Loop)</strong>
                <p>
                  {ocrResult.totalSugerencias > 0
                    ? `Se reconocieron ${ocrResult.totalSugerencias} prácticas clínicas. Valide las selecciones antes de transferirlas al ticket:`
                    : 'No se detectaron estudios coincidentes automáticamente.'}
                </p>
              </div>
            </div>

            {/* Banner de Combo o Batería de Rutina detectada */}
            {ocrResult.comboDetectado && (
              <div className="ocr-modal__combo-banner">
                <div className="ocr-modal__combo-badge">📦 Combo Detectado</div>
                <div className="ocr-modal__combo-content">
                  <strong className="ocr-modal__combo-title">{ocrResult.comboDetectado}</strong>
                  <p className="ocr-modal__combo-desc">
                    Se preseleccionaron automáticamente las prácticas correspondientes a este perfil de rutina.
                  </p>
                </div>
              </div>
            )}

            {/* Alternar vista de imagen original vs realzada */}
            {ocrResult.preprocessedDataUrl && (
              <div className="ocr-modal__view-toggle">
                <span className="ocr-modal__toggle-label">
                  <SlidersHorizontal size={14} /> Filtro Canvas:
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
                  <Sparkles size={13} /> Optimizada (Contraste)
                </button>
              </div>
            )}

            {/* Vista previa compacta */}
            <div className="ocr-modal__review-preview">
              <img
                src={viewMode === 'processed' && ocrResult.preprocessedDataUrl ? ocrResult.preprocessedDataUrl : imagePreview}
                alt="Vista de la orden"
                className="ocr-modal__review-thumbnail"
              />
              <div className="ocr-modal__review-info">
                <span className="ocr-modal__info-chip">
                  Líneas leídas: {ocrResult.detectedLines?.length || 0}
                </span>
                {ocrResult.confidence > 0 && (
                  <span className="ocr-modal__info-chip">
                    Confianza promedio: {Math.round(ocrResult.confidence)}%
                  </span>
                )}
                {ocrResult.engineUsed && (
                  <span className="ocr-modal__info-chip ocr-modal__info-chip--engine">
                    {ocrResult.engineUsed}
                  </span>
                )}
              </div>
            </div>

            {/* Grilla de Prácticas Detectadas */}
            {displayedStudies.length > 0 ? (
              <div className="ocr-modal__studies-grid">
                {displayedStudies.map((study) => {
                  const isSelected = selectedStudies.some((s) => s.id === study.id)
                  const scoreNumber = Number(study.score) || 0

                  return (
                    <label
                      key={study.id}
                      className={`ocr-modal__study-item ${isSelected ? 'ocr-modal__study-item--selected' : ''}`}
                      onClick={() => toggleStudy(study)}
                    >
                      <input
                        type="checkbox"
                        className="ocr-modal__study-checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                      />
                      <div className="ocr-modal__study-details">
                        <span className="ocr-modal__study-name">{study.nombre}</span>
                        <div className="ocr-modal__study-meta">
                          <span className="ocr-modal__study-code">{study.codigoPractica}</span>
                          <span className="ocr-modal__motor-badge ocr-modal__motor-badge--paddle">
                            🎯 PaddleOCR
                          </span>
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
                              Validado por contexto
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

            {/* Acciones finales */}
            <div className="ocr-modal__actions">
              <button
                type="button"
                className="ocr-modal__confirm-btn"
                onClick={handleConfirm}
                disabled={selectedStudies.length === 0}
              >
                Confirmar Estudios ({selectedStudies.length})
              </button>
              <button
                type="button"
                className="ocr-modal__cancel-btn"
                onClick={() => {
                  setOcrResult(null)
                  setProgressInfo({ percent: 0, message: '' })
                }}
              >
                Volver a Cargar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
