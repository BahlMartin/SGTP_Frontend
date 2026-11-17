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
  RotateCcw,
  ShieldAlert,
  Layers,
  ListChecks
} from 'lucide-react'
import {
  processRecipeFullFlow,
  reportOcrFeedbackApi,
  interpretSelectedCropsWithAiApi
} from '../../services/ocrService'
import { fetchStudiesApi } from '../../services/studyService'
import './RecipeOcrModal.css'

function normalizeLocalSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function renderStudyOriginBadge(study) {
  const scoreNumber = Math.round(Number(study.score) || 0)
  if (study.origenDeteccion === 'COMBO_RUTINA') {
    return (
      <span className="ocr-modal__origin-badge ocr-modal__origin-badge--combo">
        Combo de Rutina
      </span>
    )
  }
  if (study.origenDeteccion === 'MEMORIA_APRENDIDA') {
    return (
      <span className="ocr-modal__origin-badge ocr-modal__origin-badge--memory">
        Memoria / Trazado (x{study.vecesConfirmado || 1})
      </span>
    )
  }
  if (study.origenDeteccion === 'VISION_IA') {
    return (
      <span className="ocr-modal__origin-badge ocr-modal__origin-badge--vision">
        ✨ Visión IA
      </span>
    )
  }
  if (study.origenDeteccion === 'VALIDADO_POR_CONTEXTO') {
    return (
      <span className="ocr-modal__origin-badge ocr-modal__origin-badge--context">
        ✨ Validado por contexto
      </span>
    )
  }
  if (study.origenDeteccion === 'BUSQUEDA_MANUAL') {
    return (
      <span className="ocr-modal__origin-badge ocr-modal__origin-badge--manual">
        Buscado manualmente
      </span>
    )
  }
  if (scoreNumber > 0) {
    return (
      <span
        className={`ocr-modal__study-score ${
          scoreNumber >= 85 ? 'ocr-modal__study-score--high' : 'ocr-modal__study-score--medium'
        }`}
      >
        {scoreNumber}% coincidencia
      </span>
    )
  }
  return null
}

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

  // Estados del buscador inline, asignación rápida y consulta IA bajo demanda por renglón
  const [activeSearchLineId, setActiveSearchLineId] = useState(null)
  const [lineSearchQuery, setLineSearchQuery] = useState('')
  const [lineSearchResults, setLineSearchResults] = useState([])
  const [isSearchingLineStudies, setIsSearchingLineStudies] = useState(false)
  const [lineSearchError, setLineSearchError] = useState('')
  const [allCatalogStudies, setAllCatalogStudies] = useState([])
  const [quickCatalogStudies, setQuickCatalogStudies] = useState([])
  const [selectedForAiIds, setSelectedForAiIds] = useState([])
  const [isConsultingAi, setIsConsultingAi] = useState(false)
  const [aiConsultMessage, setAiConsultMessage] = useState('')
  const [reviewTab, setReviewTab] = useState('crops') // 'crops' | 'general'
  const [showAiPrivacyAlert, setShowAiPrivacyAlert] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchStudiesApi('')
      .then((studies) => {
        if (!mounted || !Array.isArray(studies)) return
        const activeStudies = studies.filter((s) => s?.id && s?.nombre && s.activo)
        setAllCatalogStudies(activeStudies)
        setQuickCatalogStudies(activeStudies.slice(0, 12))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

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
        textoOriginalOcr: line.textoOriginalOcr || line.texto,
        textoIa: null,
        confidence: line.confidence || 0,
        rowIndex: line.rowIndex || line.id + 1,
        colIndex: line.colIndex || 1,
        totalColsInRow: line.totalColsInRow || 1,
        visualHash: line.visualHash || '',
        cropDataUrl: line.cropDataUrl || null,
        cropStorageDataUrl: line.cropStorageDataUrl || null,
        comboDetectado: line.comboDetectado || null,
        imagenMuestraConocida: line.imagenMuestraConocida || null,
        discarded: false,
        candidates: line.recomendados || [],
        // Mejora 7: ningún estudio preseleccionado por defecto; Admisión debe tildar manualmente
        selectedIds: []
      }))

      setOcrResult(res)
      setLinesReview(initialLines)
      setExtraContextualStudies([])
      setActiveSearchLineId(null)
      setLineSearchQuery('')
      setSelectedForAiIds([])
      setAiConsultMessage('')
      setReviewTab('crops')
      setShowAiPrivacyAlert(false)
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
    if (discarded) {
      setSelectedForAiIds((prev) => prev.filter((id) => id !== lineId))
    }
    setLinesReview((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, discarded } : line
      )
    )
  }

  // Marcar / desmarcar explícitamente un recorte para enviarlo a Gemini bajo demanda
  const toggleSelectLineForAi = (lineId) => {
    setAiConsultMessage('')
    setSelectedForAiIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    )
  }

  // Helper compartido para consultar Gemini únicamente sobre los recortes explícitamente habilitados
  const consultAiLines = async (targetLines) => {
    if (!Array.isArray(targetLines) || targetLines.length === 0 || isConsultingAi) return

    setIsConsultingAi(true)
    setAiConsultMessage('')

    try {
      const recortesPayload = targetLines.map((line) => ({
        indice: line.id,
        texto_ocr: line.textoOriginalOcr || line.texto || '[Manuscrito a revisar]',
        firma_visual: line.visualHash || '',
        imagen_recorte: line.cropStorageDataUrl || line.cropDataUrl || ''
      }))

      const res = await interpretSelectedCropsWithAiApi(recortesPayload)
      const resultados = Array.isArray(res?.resultados) ? res.resultados : []
      const porIndice = new Map(resultados.map((item) => [item.indice, item]))

      let resolvedCount = 0
      setLinesReview((prev) =>
        prev.map((line) => {
          const item = porIndice.get(line.id)
          if (!item) return line

          const recs = Array.isArray(item.recomendados) ? item.recomendados : []
          if (recs.length > 0) {
            resolvedCount += 1
          }

          const existingMap = new Map(line.candidates.map((c) => [c.id, c]))
          for (const rec of recs) {
            existingMap.set(rec.id, rec)
          }

          // Mejora 7: no preseleccionar automáticamente al recibir respuesta de Gemini; conservar solo lo tildado
          return {
            ...line,
            textoOriginalOcr: line.textoOriginalOcr || line.texto,
            textoIa: item.textoTranscritoIa || line.textoIa,
            comboDetectado: item.comboDetectado || line.comboDetectado,
            candidates: Array.from(existingMap.values()),
            selectedIds: line.selectedIds
          }
        })
      )

      const processedIds = new Set(targetLines.map((l) => l.id))
      setSelectedForAiIds((prev) => prev.filter((id) => !processedIds.has(id)))
      setShowAiPrivacyAlert(false)

      if (resolvedCount > 0) {
        setAiConsultMessage(
          `IA sugirió prácticas en ${resolvedCount} de ${targetLines.length} recorte(s). Tilde las que corresponda.`
        )
      } else {
        setAiConsultMessage(
          'No se identificaron estudios en los recortes marcados (verifique su clave API o asigne manualmente).'
        )
      }
    } catch (err) {
      console.error('Error al consultar IA sobre recortes:', err)
      setAiConsultMessage('No se pudo consultar al asistente de Visión IA.')
    } finally {
      setIsConsultingAi(false)
    }
  }

  // Consultar Gemini únicamente sobre los recortes marcados por Admisión en vista Por Recortes
  const handleConsultAiSelectedCrops = () => {
    const targetLines = linesReview.filter(
      (line) =>
        !line.discarded &&
        selectedForAiIds.includes(line.id) &&
        (line.cropStorageDataUrl || line.cropDataUrl)
    )
    return consultAiLines(targetLines)
  }

  // Abrir o cerrar el buscador inline de un renglón
  const handleToggleLineSearch = (lineId) => {
    setIsSearchingLineStudies(false)
    setLineSearchQuery('')
    setLineSearchResults([])
    setLineSearchError('')
    setActiveSearchLineId((prev) => (prev === lineId ? null : lineId))
  }

  // Agregar y marcar un estudio seleccionado desde el buscador inline o chips rápidos manteniendo el fragmento actual
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
    setActiveSearchLineId((prev) => (prev === lineId ? lineId : null))
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

  const pendingLinesWithCrops = useMemo(
    () =>
      linesReview.filter(
        (l) => !l.discarded && l.selectedIds.length === 0 && (l.cropStorageDataUrl || l.cropDataUrl)
      ),
    [linesReview]
  )

  // Resultados instantáneos (0 ms) sobre el catálogo en memoria combinados con resultados remotos de alias/baterías
  const displayedLineSearchResults = useMemo(() => {
    const normQuery = normalizeLocalSearchText(lineSearchQuery)
    if (!normQuery) return []

    const merged = []
    const seenIds = new Set()

    for (const study of allCatalogStudies) {
      const normName = normalizeLocalSearchText(study.nombre)
      const normCode = normalizeLocalSearchText(study.codigo_practica)
      if (normName.includes(normQuery) || normCode.includes(normQuery)) {
        seenIds.add(study.id)
        merged.push(study)
        if (merged.length >= 20) break
      }
    }

    for (const remoteStudy of lineSearchResults) {
      if (remoteStudy?.id && !seenIds.has(remoteStudy.id)) {
        seenIds.add(remoteStudy.id)
        merged.push(remoteStudy)
      }
    }

    return merged.slice(0, 25)
  }, [lineSearchQuery, allCatalogStudies, lineSearchResults])

  // Vista General deduplicada: consolida todos los estudios sugeridos o tildados sin duplicados
  const uniqueSuggestedStudies = useMemo(() => {
    const mapById = new Map()

    for (const line of linesReview) {
      if (line.discarded) continue
      const rowLabel =
        line.totalColsInRow > 1 ? `Fila ${line.rowIndex} · Col. ${line.colIndex}` : `Fila ${line.rowIndex}`

      for (const candidate of line.candidates) {
        const isLineSelected = line.selectedIds.includes(candidate.id)
        const existing = mapById.get(candidate.id)
        if (!existing) {
          mapById.set(candidate.id, {
            ...candidate,
            isSelected: isLineSelected,
            lineIds: [line.id],
            rowLabels: [rowLabel]
          })
        } else {
          existing.isSelected = existing.isSelected || isLineSelected
          if (!existing.lineIds.includes(line.id)) {
            existing.lineIds.push(line.id)
            existing.rowLabels.push(rowLabel)
          }
          if ((candidate.score || 0) > (existing.score || 0)) {
            existing.score = candidate.score
            existing.origenDeteccion = candidate.origenDeteccion
          }
        }
      }
    }

    for (const extra of extraContextualStudies) {
      const existing = mapById.get(extra.id)
      if (!existing) {
        mapById.set(extra.id, {
          ...extra,
          isSelected: true,
          lineIds: [],
          rowLabels: ['Sugerencia contextual']
        })
      } else {
        existing.isSelected = true
      }
    }

    return Array.from(mapById.values()).sort((a, b) => {
      if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1
      return (b.score || 0) - (a.score || 0)
    })
  }, [linesReview, extraContextualStudies])

  const toggleStudyInGeneralView = (uniqueItem) => {
    if (!uniqueItem) return
    if (uniqueItem.isSelected) {
      setLinesReview((prev) =>
        prev.map((line) =>
          line.selectedIds.includes(uniqueItem.id)
            ? { ...line, selectedIds: line.selectedIds.filter((id) => id !== uniqueItem.id) }
            : line
        )
      )
      setExtraContextualStudies((prev) => prev.filter((s) => s.id !== uniqueItem.id))
      return
    }

    if (uniqueItem.lineIds.length > 0) {
      const primaryLineId = uniqueItem.lineIds[0]
      setLinesReview((prev) =>
        prev.map((line) =>
          line.id === primaryLineId && !line.selectedIds.includes(uniqueItem.id)
            ? { ...line, selectedIds: [...line.selectedIds, uniqueItem.id] }
            : line
        )
      )
    } else {
      setExtraContextualStudies((prev) =>
        prev.some((s) => s.id === uniqueItem.id) ? prev : [...prev, uniqueItem]
      )
    }
  }

  const availableQuickPicks = useMemo(() => {
    const selectedSet = new Set(allSelectedStudies.map((s) => s.id))
    const merged = []
    const seen = new Set()

    for (const sug of ocrResult?.sugerenciasContextuales || []) {
      if (!sug?.id_estudio || selectedSet.has(sug.id_estudio) || seen.has(sug.id_estudio)) continue
      seen.add(sug.id_estudio)
      merged.push({
        id: sug.id_estudio,
        nombre: sug.nombre,
        codigo_practica: sug.codigo_practica || '',
        tipo_muestra: 'Sugerencia'
      })
    }

    for (const cat of quickCatalogStudies) {
      if (!cat?.id || selectedSet.has(cat.id) || seen.has(cat.id)) continue
      seen.add(cat.id)
      merged.push(cat)
      if (merged.length >= 6) break
    }

    return merged.slice(0, 6)
  }, [ocrResult, quickCatalogStudies, allSelectedStudies])

  const handleConfirm = () => {
    if (ocrResult && (linesReview.length > 0 || allSelectedStudies.length > 0)) {
      const activeConfirmLines = linesReview.filter((line) => !line.discarded && line.selectedIds.length > 0)
      const renglonesConfirmados = activeConfirmLines.map((line) => ({
        texto: line.textoOriginalOcr || line.texto,
        estudiosIds: line.selectedIds,
        imagenMuestra: line.cropStorageDataUrl || line.cropDataUrl || ''
      }))

      // Si Gemini transcribió una variante cursiva distinta al texto original de PaddleOCR, memorizar ambas
      const asociacionesDirectas = []
      for (const line of activeConfirmLines) {
        const textoOrig = (line.textoOriginalOcr || line.texto || '').trim()
        const textoIa = (line.textoIa || '').trim()
        if (!textoIa || textoIa === textoOrig || textoIa === '[Manuscrito a revisar]') continue
        if (line.selectedIds.length === 1) {
          asociacionesDirectas.push({ texto: textoIa, estudioId: line.selectedIds[0] })
        } else {
          renglonesConfirmados.push({
            texto: textoIa,
            estudiosIds: line.selectedIds,
            imagenMuestra: line.cropStorageDataUrl || line.cropDataUrl || ''
          })
        }
      }

      const lineasDescartadas = linesReview
        .filter((line) => line.discarded && (line.textoOriginalOcr || line.texto) !== '[Manuscrito a revisar]')
        .map((line) => line.textoOriginalOcr || line.texto)

      const recortesDescartados = linesReview
        .filter((line) => line.discarded && (line.cropStorageDataUrl || line.cropDataUrl))
        .map((line) => ({
          texto: line.textoOriginalOcr || line.texto || '',
          imagenMuestra: line.cropStorageDataUrl || line.cropDataUrl || ''
        }))

      reportOcrFeedbackApi({
        lineasOrigen: ocrResult.detectedLines || [],
        estudiosConfirmadosIds: allSelectedStudies.map((s) => s.id),
        asociacionesDirectas,
        renglonesConfirmados,
        lineasDescartadas,
        recortesDescartados
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
              {uniqueSuggestedStudies.length > 0 ? (
                <>
                  <strong>{uniqueSuggestedStudies.length} estudios sugeridos</strong>
                  <span className="ocr-modal__alert-subtext">
                    — Tilde manualmente los que correspondan
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

              {/* Panel Derecho: Revisión con Doble Vista (Por Recortes / Vista General) y Sugerencias */}
              <div className="ocr-modal__main-panel">
                <div className="ocr-modal__alert ocr-modal__alert--desktop">
                  <Check size={15} className="ocr-modal__alert-icon" />
                  <div className="ocr-modal__alert-content">
                    <strong>{allSelectedStudies.length} prácticas marcadas</strong>
                    <span className="ocr-modal__alert-subtext">
                      {allSelectedStudies.length === 0
                        ? `— Tilde manualmente los estudios que correspondan (${pendingLinesCount} renglón(es) sin marcar)`
                        : pendingLinesCount > 0
                          ? `— ${pendingLinesCount} renglón(es) sin estudio asignado; tilde o descarte según corresponda`
                          : '— Verifique las prácticas tildadas antes de confirmar'}
                    </span>
                  </div>
                </div>

                {/* Pestañas: Por Recortes vs Vista General sin Duplicados */}
                {linesReview.length > 0 && (
                  <div className="ocr-modal__tabs" role="tablist" aria-label="Modo de revisión OCR">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={reviewTab === 'crops'}
                      className={`ocr-modal__tab-btn ${reviewTab === 'crops' ? 'ocr-modal__tab-btn--active' : ''}`}
                      onClick={() => {
                        setReviewTab('crops')
                        setShowAiPrivacyAlert(false)
                      }}
                    >
                      <Layers size={14} />
                      <span>Por Recortes ({activeLinesCount})</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={reviewTab === 'general'}
                      className={`ocr-modal__tab-btn ${reviewTab === 'general' ? 'ocr-modal__tab-btn--active' : ''}`}
                      onClick={() => setReviewTab('general')}
                    >
                      <ListChecks size={14} />
                      <span>Vista General ({uniqueSuggestedStudies.length})</span>
                    </button>
                  </div>
                )}

                {linesReview.length > 0 && reviewTab === 'crops' && (
                  <div className="ocr-modal__ai-batch-bar">
                    <div className="ocr-modal__ai-batch-info">
                      <span>🔒 Privacidad: solo se envían a Gemini los recortes que marque con 'Enviar a IA'.</span>
                      {aiConsultMessage && (
                        <strong className="ocr-modal__ai-batch-status">{aiConsultMessage}</strong>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ocr-modal__ai-batch-btn"
                      disabled={selectedForAiIds.length === 0 || isConsultingAi}
                      onClick={handleConsultAiSelectedCrops}
                    >
                      <Sparkles size={14} />
                      <span>
                        {isConsultingAi
                          ? 'Consultando Gemini...'
                          : `✨ Consultar IA en marcados (${selectedForAiIds.length})`}
                      </span>
                    </button>
                  </div>
                )}

                {reviewTab === 'general' && linesReview.length > 0 ? (
                  <div className="ocr-modal__general-view">
                    <div className="ocr-modal__ai-batch-bar">
                      <div className="ocr-modal__ai-batch-info">
                        <span>
                          Lista consolidada sin duplicados. Tilde manualmente cada estudio a confirmar.
                        </span>
                        {aiConsultMessage && (
                          <strong className="ocr-modal__ai-batch-status">{aiConsultMessage}</strong>
                        )}
                      </div>
                      <button
                        type="button"
                        className="ocr-modal__ai-batch-btn"
                        disabled={pendingLinesWithCrops.length === 0 || isConsultingAi}
                        onClick={() => setShowAiPrivacyAlert((prev) => !prev)}
                      >
                        <Sparkles size={14} />
                        <span>
                          {isConsultingAi
                            ? 'Consultando Gemini...'
                            : `✨ Escanear con IA (${pendingLinesWithCrops.length})`}
                        </span>
                      </button>
                    </div>

                    {/* Guardián de Privacidad PHI antes de enviar recortes desde Vista General */}
                    {showAiPrivacyAlert && (
                      <div className="ocr-modal__privacy-guard" role="alert">
                        <div className="ocr-modal__privacy-guard-header">
                          <ShieldAlert size={18} className="ocr-modal__privacy-guard-icon" />
                          <div>
                            <strong>Alerta de Privacidad (Datos Sensibles)</strong>
                            <p className="ocr-modal__privacy-guard-desc">
                              Revise estas imágenes antes de enviarlas a Gemini. Si alguna contiene Nombre, DNI,
                              Obra Social, Nro. de Afiliado o Firma médica, presione &quot;Descartar&quot; para
                              excluirla.
                            </p>
                          </div>
                        </div>

                        {pendingLinesWithCrops.length > 0 ? (
                          <div className="ocr-modal__privacy-crops-grid">
                            {pendingLinesWithCrops.map((cropLine) => (
                              <div key={`priv-${cropLine.id}`} className="ocr-modal__privacy-crop-item">
                                {cropLine.cropDataUrl && (
                                  <img
                                    src={cropLine.cropDataUrl}
                                    alt={`Recorte pendiente ${cropLine.texto}`}
                                    className="ocr-modal__privacy-crop-img"
                                  />
                                )}
                                <div className="ocr-modal__privacy-crop-footer">
                                  <span className="ocr-modal__privacy-crop-label">
                                    Fila {cropLine.rowIndex} · &quot;{cropLine.texto}&quot;
                                  </span>
                                  <button
                                    type="button"
                                    className="ocr-modal__line-ignore-btn"
                                    onClick={() => toggleDiscardLine(cropLine.id, true)}
                                  >
                                    <Ban size={12} />
                                    <span>Descartar (datos sensibles)</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="ocr-modal__privacy-guard-empty">
                            No quedan recortes pendientes para enviar a IA.
                          </p>
                        )}

                        <div className="ocr-modal__privacy-guard-actions">
                          <button
                            type="button"
                            className="ocr-modal__line-restore-btn"
                            onClick={() => setShowAiPrivacyAlert(false)}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="ocr-modal__ai-batch-btn"
                            disabled={pendingLinesWithCrops.length === 0 || isConsultingAi}
                            onClick={() => consultAiLines(pendingLinesWithCrops)}
                          >
                            <Sparkles size={14} />
                            <span>
                              Confirmar y Enviar ({pendingLinesWithCrops.length}) a IA
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {uniqueSuggestedStudies.length > 0 ? (
                      <div className="ocr-modal__studies-grid">
                        {uniqueSuggestedStudies.map((study) => (
                          <label
                            key={`gen-${study.id}`}
                            className={`ocr-modal__study-item ${
                              study.isSelected ? 'ocr-modal__study-item--selected' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="ocr-modal__study-checkbox"
                              checked={study.isSelected}
                              onChange={() => toggleStudyInGeneralView(study)}
                            />
                            <div className="ocr-modal__study-details">
                              <span className="ocr-modal__study-name">{study.nombre}</span>
                              <div className="ocr-modal__study-meta">
                                {study.codigoPractica && (
                                  <span className="ocr-modal__study-code">{study.codigoPractica}</span>
                                )}
                                {renderStudyOriginBadge(study)}
                                {study.rowLabels?.length > 0 && (
                                  <span className="ocr-modal__line-conf">
                                    {study.rowLabels.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="ocr-modal__no-studies-msg">
                        <AlertCircle size={16} />
                        <span>
                          Todavía no hay estudios sugeridos. Use la pestaña &quot;Por Recortes&quot; o
                          &quot;Escanear con IA&quot; sobre recortes revisados.
                        </span>
                      </div>
                    )}
                  </div>
                ) : linesReview.length > 0 ? (
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
                                  <span className="ocr-modal__line-pos-badge">
                                    {line.totalColsInRow > 1
                                      ? `Fila ${line.rowIndex} · Col. ${line.colIndex}`
                                      : `Fila ${line.rowIndex}`}
                                  </span>
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
                                  {line.textoIa && (
                                    <span className="ocr-modal__origin-badge ocr-modal__origin-badge--vision">
                                      ✨ IA leyó: {line.textoIa}
                                    </span>
                                  )}
                                  {line.imagenMuestraConocida && (
                                    <span
                                      className="ocr-modal__known-trace-pill"
                                      title="Coincide con un recorte manuscrito guardado previamente"
                                    >
                                      <img
                                        src={line.imagenMuestraConocida}
                                        alt="Trazo coincidente previo"
                                        className="ocr-modal__known-trace-thumb"
                                      />
                                      <span>Trazo histórico coincidente</span>
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
                              {(line.cropStorageDataUrl || line.cropDataUrl) && (
                                <label
                                  className={`ocr-modal__line-ai-check ${
                                    selectedForAiIds.includes(line.id) ? 'ocr-modal__line-ai-check--active' : ''
                                  }`}
                                  title="Marcar este recorte aislado para consultarlo con Gemini IA"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedForAiIds.includes(line.id)}
                                    onChange={() => toggleSelectLineForAi(line.id)}
                                  />
                                  <Sparkles size={13} />
                                  <span>Enviar a IA</span>
                                </label>
                              )}
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
                                  key={`search-${line.id}`}
                                  type="search"
                                  className="ocr-modal__line-search-input"
                                  placeholder="Escriba nombre o abreviatura y presione Enter..."
                                  value={lineSearchQuery}
                                  onChange={(e) => {
                                    const nextQuery = e.target.value
                                    setLineSearchQuery(nextQuery)
                                    setLineSearchResults([])
                                    setIsSearchingLineStudies(Boolean(nextQuery.trim()))
                                    setLineSearchError('')
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && displayedLineSearchResults.length > 0) {
                                      e.preventDefault()
                                      handleAssignSearchedStudyToLine(line.id, displayedLineSearchResults[0])
                                    }
                                  }}
                                  autoFocus
                                  autoComplete="off"
                                />
                              </div>

                              {lineSearchQuery.trim() && (
                                <div className="ocr-modal__line-search-dropdown">
                                  {displayedLineSearchResults.length === 0 && isSearchingLineStudies ? (
                                    <div className="ocr-modal__line-search-status">
                                      Buscando en catálogo y memoria...
                                    </div>
                                  ) : lineSearchError && displayedLineSearchResults.length === 0 ? (
                                    <div className="ocr-modal__line-search-status ocr-modal__line-search-status--error">
                                      {lineSearchError}
                                    </div>
                                  ) : displayedLineSearchResults.length === 0 ? (
                                    <div className="ocr-modal__line-search-status">
                                      No se encontraron estudios activos para &quot;{lineSearchQuery.trim()}&quot;.
                                    </div>
                                  ) : (
                                    <ul className="ocr-modal__line-search-results">
                                      {displayedLineSearchResults.map((study) => {
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

                          {/* Chips de asignación rápida en 1 clic para bloques pendientes */}
                          {!hasSelected && availableQuickPicks.length > 0 && (
                            <div className="ocr-modal__quick-assign-bar">
                              <span className="ocr-modal__quick-assign-label">Asignar en 1 clic:</span>
                              <div className="ocr-modal__quick-assign-chips">
                                {availableQuickPicks.map((study) => (
                                  <button
                                    key={`${line.id}-quick-${study.id}`}
                                    type="button"
                                    className="ocr-modal__quick-assign-chip"
                                    onClick={() => handleAssignSearchedStudyToLine(line.id, study)}
                                    title={`Asignar y memorizar ${study.nombre} en este recorte`}
                                  >
                                    <Plus size={12} />
                                    <span>{study.nombre}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Estudios Recomendados / Asignados al Renglón */}
                          {line.candidates.length > 0 ? (
                            <div className="ocr-modal__studies-grid">
                              {line.candidates.map((study) => {
                                const isSelected = line.selectedIds.includes(study.id)

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
                                        {renderStudyOriginBadge(study)}
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
                  setSelectedForAiIds([])
                  setAiConsultMessage('')
                  setReviewTab('crops')
                  setShowAiPrivacyAlert(false)
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
