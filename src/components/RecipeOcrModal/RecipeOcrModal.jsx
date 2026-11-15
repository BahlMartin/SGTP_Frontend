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
  Plus,
  Search,
  Ban,
  RotateCcw
} from 'lucide-react'
import { processRecipeFullFlow, reportOcrFeedbackApi } from '../../services/ocrService'
import { fetchStudiesApi } from '../../services/studyService'
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
  const [linesReview, setLinesReview] = useState([])
  const [extraContextualStudies, setExtraContextualStudies] = useState([])
  const [showFloatingAlert, setShowFloatingAlert] = useState(false)

  // Estados del buscador inline por renglón
  const [activeSearchLineId, setActiveSearchLineId] = useState(null)
  const [lineSearchQuery, setLineSearchQuery] = useState('')
  const [lineSearchResults, setLineSearchResults] = useState([])
  const [isSearchingLineStudies, setIsSearchingLineStudies] = useState(false)
  const [lineSearchError, setLineSearchError] = useState('')

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

  // Búsqueda debounceada de estudios en el catálogo para el renglón activo
  useEffect(() => {
    const query = lineSearchQuery.trim()
    if (activeSearchLineId === null || !query) {
      return undefined
    }

    let isCurrent = true
    const timer = setTimeout(async () => {
      try {
        const studies = await fetchStudiesApi(query)
        if (isCurrent) {
          setLineSearchResults(
            studies.filter((study) => study?.id && study?.nombre && study.activo)
          )
        }
      } catch (err) {
        console.error('Error al buscar estudios desde renglón OCR:', err)
        if (isCurrent) {
          setLineSearchResults([])
          setLineSearchError('No se pudo consultar el catálogo de estudios.')
        }
      } finally {
        if (isCurrent) {
          setIsSearchingLineStudies(false)
        }
      }
    }, 250)

    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [activeSearchLineId, lineSearchQuery])

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

      const initialLines = (res.detectedLinesDetail || []).map((line) => ({
        id: line.id,
        texto: line.texto,
        confidence: line.confidence || 0,
        cropDataUrl: line.cropDataUrl || null,
        cropStorageDataUrl: line.cropStorageDataUrl || null,
        comboDetectado: line.comboDetectado || null,
        imagenMuestraConocida: line.imagenMuestraConocida || null,
        discarded: false,
        candidates: line.recomendados || [],
        selectedIds: (line.recomendados || [])
          .filter((r) => r.preseleccionado)
          .map((r) => r.id)
      }))

      setOcrResult(res)
      setLinesReview(initialLines)
      setExtraContextualStudies([])
      setActiveSearchLineId(null)
      setLineSearchQuery('')
      setShowFloatingAlert(true)
    } catch (err) {
      console.error('Error al procesar receta OCR:', err)
      setOcrError(err.message || 'No se pudo procesar la receta médica.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Marcar / desmarcar un estudio dentro de un renglón específico
  const toggleStudyInLine = (lineId, studyId) => {
    setLinesReview((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line
        const exists = line.selectedIds.includes(studyId)
        return {
          ...line,
          selectedIds: exists
            ? line.selectedIds.filter((id) => id !== studyId)
            : [...line.selectedIds, studyId]
        }
      })
    )
  }

  // Descartar o restaurar un renglón ("No es estudio / Ignorar")
  const toggleDiscardLine = (lineId, discarded) => {
    if (discarded && activeSearchLineId === lineId) {
      setActiveSearchLineId(null)
      setLineSearchQuery('')
    }
    setLinesReview((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, discarded } : line
      )
    )
  }

  // Abrir o cerrar el buscador inline de un renglón
  const handleToggleLineSearch = (lineId) => {
    setIsSearchingLineStudies(false)
    setLineSearchQuery('')
    setLineSearchResults([])
    setLineSearchError('')
    setActiveSearchLineId((prev) => (prev === lineId ? null : lineId))
  }

  // Agregar y marcar un estudio seleccionado desde el buscador inline de un renglón
  const handleAssignSearchedStudyToLine = (lineId, studyFromApi) => {
    setLinesReview((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line
        const alreadyCandidate = line.candidates.some((c) => c.id === studyFromApi.id)
        const nextCandidates = alreadyCandidate
          ? line.candidates
          : [
              ...line.candidates,
              {
                id: studyFromApi.id,
                nombre: studyFromApi.nombre,
                categoria: studyFromApi.tipo_muestra || 'Otro',
                codigoPractica: studyFromApi.codigo_practica || '',
                score: 100,
                textoOrigen: line.texto,
                origenDeteccion: 'BUSQUEDA_MANUAL',
                preseleccionado: true
              }
            ]
        const nextSelectedIds = line.selectedIds.includes(studyFromApi.id)
          ? line.selectedIds
          : [...line.selectedIds, studyFromApi.id]

        return {
          ...line,
          discarded: false,
          candidates: nextCandidates,
          selectedIds: nextSelectedIds
        }
      })
    )
    setLineSearchQuery('')
    setLineSearchResults([])
    setIsSearchingLineStudies(false)
    setLineSearchError('')
    setActiveSearchLineId(null)
  }

  // Unión deduplicada de todos los estudios confirmados en renglones activos + sugerencias contextuales
  const allSelectedStudies = useMemo(() => {
    const mapById = new Map()
    for (const line of linesReview) {
      if (line.discarded) continue
      for (const candidate of line.candidates) {
        if (line.selectedIds.includes(candidate.id) && !mapById.has(candidate.id)) {
          mapById.set(candidate.id, candidate)
        }
      }
    }
    for (const extra of extraContextualStudies) {
      if (!mapById.has(extra.id)) {
        mapById.set(extra.id, extra)
      }
    }
    return Array.from(mapById.values())
  }, [linesReview, extraContextualStudies])

  const activeLinesCount = useMemo(
    () => linesReview.filter((l) => !l.discarded).length,
    [linesReview]
  )

  const pendingLinesCount = useMemo(
    () => linesReview.filter((l) => !l.discarded && l.selectedIds.length === 0).length,
    [linesReview]
  )

  const handleConfirm = () => {
    if (ocrResult && (linesReview.length > 0 || allSelectedStudies.length > 0)) {
      const renglonesConfirmados = linesReview
        .filter((line) => !line.discarded && line.selectedIds.length > 0)
        .map((line) => ({
          texto: line.texto,
          estudiosIds: line.selectedIds,
          imagenMuestra: line.cropStorageDataUrl || line.cropDataUrl || ''
        }))

      const lineasDescartadas = linesReview
        .filter((line) => line.discarded)
        .map((line) => line.texto)

      reportOcrFeedbackApi({
        lineasOrigen: ocrResult.detectedLines || [],
        estudiosConfirmadosIds: allSelectedStudies.map((s) => s.id),
        asociacionesDirectas: [],
        renglonesConfirmados,
        lineasDescartadas
      }).catch((err) => {
        console.warn('Feedback OCR no crítico falló:', err)
      })
    }

    onConfirmStudies(allSelectedStudies)
    onClose()
  }

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
              {allSelectedStudies.length > 0 ? (
                <>
                  <strong>{allSelectedStudies.length} prácticas preseleccionadas</strong>
                  <span className="ocr-modal__alert-subtext">
                    — Valide cada renglón
                  </span>
                </>
              ) : (
                <span>Revise los renglones detectados y asigne los estudios.</span>
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
            Revisión renglón por renglón con aprendizaje continuo de abreviaturas, baterías y recortes visuales.
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
          /* Vista de Revisión Renglón por Renglón (Human-in-the-Loop) */
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
                        Renglones: {activeLinesCount}
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

              {/* Panel Derecho: Revisión Renglón por Renglón y Sugerencias */}
              <div className="ocr-modal__main-panel">
                <div className="ocr-modal__alert ocr-modal__alert--desktop">
                  <Check size={15} className="ocr-modal__alert-icon" />
                  <div className="ocr-modal__alert-content">
                    <strong>{allSelectedStudies.length} prácticas marcadas</strong>
                    <span className="ocr-modal__alert-subtext">
                      {pendingLinesCount > 0
                        ? `— ${pendingLinesCount} renglón(es) sin estudio asignado; busque o descarte según corresponda`
                        : '— Verifique cada renglón antes de confirmar'}
                    </span>
                  </div>
                </div>

                {linesReview.length > 0 ? (
                  <div className="ocr-modal__lines-list">
                    {linesReview.map((line) => {
                      if (line.discarded) {
                        return (
                          <div key={line.id} className="ocr-modal__line-card ocr-modal__line-card--discarded">
                            <div className="ocr-modal__line-discarded-info">
                              <Ban size={14} className="ocr-modal__line-discarded-icon" />
                              <span className="ocr-modal__line-discarded-text">
                                Ignorado: <s>{line.texto}</s>
                              </span>
                            </div>
                            <button
                              type="button"
                              className="ocr-modal__line-restore-btn"
                              onClick={() => toggleDiscardLine(line.id, false)}
                            >
                              <RotateCcw size={13} />
                              Restaurar
                            </button>
                          </div>
                        )
                      }

                      const hasSelected = line.selectedIds.length > 0
                      const isSearchOpen = activeSearchLineId === line.id

                      return (
                        <div
                          key={line.id}
                          className={`ocr-modal__line-card ${
                            hasSelected
                              ? 'ocr-modal__line-card--matched'
                              : 'ocr-modal__line-card--attention'
                          }`}
                        >
                          {/* Encabezado del Renglón: Recorte + Texto leído + Acciones */}
                          <div className="ocr-modal__line-header">
                            <div className="ocr-modal__line-source">
                              {line.cropDataUrl && (
                                <div className="ocr-modal__line-crop-wrap">
                                  <img
                                    src={line.cropDataUrl}
                                    alt={`Recorte de ${line.texto}`}
                                    className="ocr-modal__line-crop-img"
                                  />
                                </div>
                              )}
                              <div className="ocr-modal__line-text-block">
                                <div className="ocr-modal__line-text-row">
                                  <span className="ocr-modal__line-label">Renglón:</span>
                                  <span className="ocr-modal__line-text">{line.texto}</span>
                                </div>
                                <div className="ocr-modal__line-badges">
                                  {line.confidence > 0 && (
                                    <span className="ocr-modal__line-conf">
                                      OCR {Math.round(line.confidence)}%
                                    </span>
                                  )}
                                  {line.comboDetectado && (
                                    <span className="ocr-modal__origin-badge ocr-modal__origin-badge--combo">
                                      📦 {line.comboDetectado}
                                    </span>
                                  )}
                                  {line.candidates.length === 0 && (
                                    <span className="ocr-modal__line-unmatched-badge">
                                      Sin coincidencia automática
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="ocr-modal__line-actions">
                              <button
                                type="button"
                                className={`ocr-modal__line-search-toggle ${
                                  isSearchOpen ? 'ocr-modal__line-search-toggle--active' : ''
                                }`}
                                onClick={() => handleToggleLineSearch(line.id)}
                                title="Buscar estudio manualmente para este renglón"
                              >
                                <Search size={13} />
                                <span>{isSearchOpen ? 'Cerrar buscador' : 'Buscar estudio'}</span>
                              </button>
                              <button
                                type="button"
                                className="ocr-modal__line-ignore-btn"
                                onClick={() => toggleDiscardLine(line.id, true)}
                                title="Marcar este renglón como ruido o texto no médico"
                              >
                                <Ban size={13} />
                                <span>No es estudio</span>
                              </button>
                            </div>
                          </div>

                          {/* Buscador Inline para este renglón */}
                          {isSearchOpen && (
                            <div className="ocr-modal__line-search-box">
                              <div className="ocr-modal__line-search-input-wrap">
                                <Search size={14} className="ocr-modal__line-search-icon" />
                                <input
                                  type="search"
                                  className="ocr-modal__line-search-input"
                                  placeholder="Escriba nombre, código o abreviatura del estudio..."
                                  value={lineSearchQuery}
                                  onChange={(e) => {
                                    const nextQuery = e.target.value
                                    setLineSearchQuery(nextQuery)
                                    setLineSearchResults([])
                                    setIsSearchingLineStudies(Boolean(nextQuery.trim()))
                                    setLineSearchError('')
                                  }}
                                  autoFocus
                                  autoComplete="off"
                                />
                              </div>

                              {lineSearchQuery.trim() && (
                                <div className="ocr-modal__line-search-dropdown">
                                  {isSearchingLineStudies ? (
                                    <div className="ocr-modal__line-search-status">
                                      Buscando en catálogo y memoria...
                                    </div>
                                  ) : lineSearchError ? (
                                    <div className="ocr-modal__line-search-status ocr-modal__line-search-status--error">
                                      {lineSearchError}
                                    </div>
                                  ) : lineSearchResults.length === 0 ? (
                                    <div className="ocr-modal__line-search-status">
                                      No se encontraron estudios activos para "{lineSearchQuery.trim()}".
                                    </div>
                                  ) : (
                                    <ul className="ocr-modal__line-search-results">
                                      {lineSearchResults.map((study) => {
                                        const alreadySelected = line.selectedIds.includes(study.id)
                                        return (
                                          <li key={study.id}>
                                            <button
                                              type="button"
                                              className="ocr-modal__line-search-result-btn"
                                              onClick={() => handleAssignSearchedStudyToLine(line.id, study)}
                                            >
                                              <span className="ocr-modal__line-search-result-main">
                                                <Plus size={13} />
                                                <span>{study.nombre}</span>
                                              </span>
                                              <span className="ocr-modal__line-search-result-meta">
                                                {study.codigo_practica}
                                                {alreadySelected ? ' · Ya marcado' : ''}
                                              </span>
                                            </button>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Estudios Recomendados / Asignados al Renglón */}
                          {line.candidates.length > 0 ? (
                            <div className="ocr-modal__studies-grid">
                              {line.candidates.map((study) => {
                                const isSelected = line.selectedIds.includes(study.id)
                                const scoreNumber = Math.round(Number(study.score) || 0)

                                return (
                                  <label
                                    key={`${line.id}-${study.id}`}
                                    className={`ocr-modal__study-item ${
                                      isSelected ? 'ocr-modal__study-item--selected' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="ocr-modal__study-checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleStudyInLine(line.id, study.id)}
                                    />
                                    <div className="ocr-modal__study-details">
                                      <span className="ocr-modal__study-name">{study.nombre}</span>
                                      <div className="ocr-modal__study-meta">
                                        {study.codigoPractica && (
                                          <span className="ocr-modal__study-code">{study.codigoPractica}</span>
                                        )}
                                        {study.origenDeteccion === 'COMBO_RUTINA' ? (
                                          <span className="ocr-modal__origin-badge ocr-modal__origin-badge--combo">
                                            Combo de Rutina
                                          </span>
                                        ) : study.origenDeteccion === 'MEMORIA_APRENDIDA' ? (
                                          <span className="ocr-modal__origin-badge ocr-modal__origin-badge--memory">
                                            Memoria (x{study.vecesConfirmado || 1})
                                          </span>
                                        ) : study.origenDeteccion === 'VALIDADO_POR_CONTEXTO' ? (
                                          <span className="ocr-modal__origin-badge ocr-modal__origin-badge--context">
                                            ✨ Validado por contexto
                                          </span>
                                        ) : study.origenDeteccion === 'BUSQUEDA_MANUAL' ? (
                                          <span className="ocr-modal__origin-badge ocr-modal__origin-badge--manual">
                                            Buscado manualmente
                                          </span>
                                        ) : scoreNumber > 0 ? (
                                          <span
                                            className={`ocr-modal__study-score ${
                                              scoreNumber >= 85
                                                ? 'ocr-modal__study-score--high'
                                                : 'ocr-modal__study-score--medium'
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
                            !isSearchOpen && (
                              <button
                                type="button"
                                className="ocr-modal__line-empty-hint"
                                onClick={() => handleToggleLineSearch(line.id)}
                              >
                                <Search size={14} />
                                <span>
                                  No se ofreció un estudio automático. Haga clic aquí para buscar y marcar el estudio correcto.
                                </span>
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="ocr-modal__no-studies-msg">
                    <AlertCircle size={16} />
                    <span>
                      No se detectaron renglones válidos con PaddleOCR en la imagen cargada.
                    </span>
                  </div>
                )}

                {/* Prácticas agregadas desde sugerencias contextuales */}
                {extraContextualStudies.length > 0 && (
                  <div className="ocr-modal__extra-contextual-list">
                    <span className="ocr-modal__extra-contextual-title">
                      Agregados desde sugerencias frecuentes:
                    </span>
                    <div className="ocr-modal__contextual-chips">
                      {extraContextualStudies.map((study) => (
                        <button
                          key={study.id}
                          type="button"
                          className="ocr-modal__contextual-chip ocr-modal__contextual-chip--added"
                          onClick={() =>
                            setExtraContextualStudies((prev) => prev.filter((s) => s.id !== study.id))
                          }
                          title="Quitar estudio agregado"
                        >
                          <Check size={13} />
                          <span>{study.nombre}</span>
                          <X size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sugerencias contextuales de estudios co-ocurrentes */}
                {ocrResult.sugerenciasContextuales?.length > 0 && (() => {
                  const visibleSuggestions = ocrResult.sugerenciasContextuales.filter(
                    (sug) => !allSelectedStudies.some((s) => s.id === sug.id_estudio)
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
                              setExtraContextualStudies((prev) => [
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
                  setLinesReview([])
                  setExtraContextualStudies([])
                  setActiveSearchLineId(null)
                  setLineSearchQuery('')
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
                disabled={allSelectedStudies.length === 0}
              >
                Confirmar Estudios ({allSelectedStudies.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
