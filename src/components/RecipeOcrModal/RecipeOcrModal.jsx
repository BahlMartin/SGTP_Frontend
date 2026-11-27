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
  Layers,
  ListChecks,
  Crop,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  processRecipeFullFlow,
  reportOcrFeedbackApi,
  interpretContextualRecipeWithAiApi,
  processManualRecipeCrop,
  fetchOcrConfigApi
} from '../../services/ocrService'
import { fetchStudiesApi } from '../../services/studyService'
import RecipeAiRedactionEditor from './RecipeAiRedactionEditor'
import RecipeManualCropSelector from './RecipeManualCropSelector'
import './RecipeOcrModal.css'

function normalizeLineBboxes(lines, width, height, pad = 0) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  if (w <= 0 || h <= 0) return []
  return lines
    .filter((l) => l?.bbox)
    .map((l) => {
      const x = Math.max(0, l.bbox.minX / w - pad)
      const y = Math.max(0, l.bbox.minY / h - pad)
      const maxX = Math.min(1, l.bbox.maxX / w + pad)
      const maxY = Math.min(1, l.bbox.maxY / h + pad)
      return {
        x,
        y,
        w: Math.max(0.02, maxX - x),
        h: Math.max(0.015, maxY - y)
      }
    })
}

function normalizeLocalSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function buildCandidateFromTrace(
  trace,
  estId,
  fallbackIdx = 0,
  lineTexto = '',
  allCatalogStudies = []
) {
  const catalogStudy = allCatalogStudies.find((s) => Number(s.id) === Number(estId))
  const fallbackName = trace?.estudiosNombres?.[fallbackIdx]
  return {
    id: estId,
    nombre: catalogStudy?.nombre || fallbackName || `Estudio #${estId}`,
    categoria: catalogStudy?.tipo_muestra || 'Otro',
    codigoPractica: catalogStudy?.codigo_practica || '',
    score: Number(trace?.similitudScore) || 0,
    textoOrigen: lineTexto || '',
    origenDeteccion: 'TRAZO_VISUAL',
    preseleccionado: false,
    vecesConfirmado: 1,
    imagenMuestra: trace?.imagenMuestra || null
  }
}

function syncTraceStudiesIntoCandidates(
  candidates = [],
  trazosCoincidentes = [],
  lineTexto = '',
  allCatalogStudies = []
) {
  const nextCandidates = Array.isArray(candidates) ? [...candidates] : []
  const existingIds = new Set(nextCandidates.map((c) => Number(c.id)))

  for (const trace of trazosCoincidentes || []) {
    if (!trace || !Array.isArray(trace.estudiosIds)) continue
    trace.estudiosIds.forEach((estId, idx) => {
      const numId = Number(estId)
      if (!numId || existingIds.has(numId)) return
      existingIds.add(numId)
      nextCandidates.push(
        buildCandidateFromTrace(trace, estId, idx, lineTexto, allCatalogStudies)
      )
    })
  }
  return nextCandidates
}

function isCandidatePenalized(line, study) {
  if (
    !line ||
    !study ||
    (study.origenDeteccion !== 'MEMORIA_APRENDIDA' &&
      study.origenDeteccion !== 'TRAZO_VISUAL' &&
      study.origenDeteccion !== 'COMBO_RUTINA')
  ) {
    return false
  }
  const matchingTraces = (line.trazosCoincidentes || []).filter(
    (trace) => Array.isArray(trace.estudiosIds) && trace.estudiosIds.includes(study.id)
  )
  if (matchingTraces.length === 0) {
    return false
  }
  const votes = line.traceVotes || {}
  return matchingTraces.every((trace) => votes[trace.recorteId] === 'down')
}

function applyLineSelectionWithAutoTraceVotes(
  line,
  nextSelectedIds,
  { allowAutoUpvotes = true } = {}
) {
  const nextVotes = { ...(line.traceVotes || {}) }
  const nextAutoVotes = { ...(line.autoTraceVotes || {}) }
  const selectedNumSet = new Set((nextSelectedIds || []).map((id) => Number(id)))
  const trazos = Array.isArray(line.trazosCoincidentes) ? line.trazosCoincidentes : []

  for (const trace of trazos) {
    if (!trace || trace.recorteId === undefined || trace.recorteId === null) continue
    const recId = trace.recorteId
    const hasSelectedStudy =
      Array.isArray(trace.estudiosIds) &&
      trace.estudiosIds.some((id) => selectedNumSet.has(Number(id)))

    if (hasSelectedStudy) {
      if (allowAutoUpvotes && !nextVotes[recId]) {
        nextVotes[recId] = 'up'
        nextAutoVotes[recId] = true
      }
    } else if (nextAutoVotes[recId] && nextVotes[recId] === 'up') {
      delete nextVotes[recId]
      delete nextAutoVotes[recId]
    }
  }

  return {
    ...line,
    selectedIds: nextSelectedIds,
    traceVotes: nextVotes,
    autoTraceVotes: nextAutoVotes
  }
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
        {scoreNumber > 0
          ? `Memoria texto · ${scoreNumber}%`
          : `Memoria texto (x${study.vecesConfirmado || 1})`}
      </span>
    )
  }
  if (study.origenDeteccion === 'TRAZO_VISUAL') {
    return (
      <span className="ocr-modal__origin-badge ocr-modal__origin-badge--trace">
        {scoreNumber > 0
          ? `Trazo visual · ${scoreNumber}%`
          : `Trazo visual (x${study.vecesConfirmado || 1})`}
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
        className={`ocr-modal__study-score ${scoreNumber >= 85 ? 'ocr-modal__study-score--high' : 'ocr-modal__study-score--medium'
          }`}
      >
        {scoreNumber}% coincidencia
      </span>
    )
  }
  return null
}

const INITIAL_VISIBLE_TRACES = 6
const GENERAL_VISUAL_TRACE_MIN_SCORE = 42
const GENERAL_MEMORY_MIN_SCORE = 65
const GENERAL_DIRECT_MIN_SCORE = 75
const ORIGIN_PRIORITY = {
  BUSQUEDA_MANUAL: 6,
  VISION_IA: 5,
  COMBO_RUTINA: 4,
  VALIDADO_POR_CONTEXTO: 3,
  MEMORIA_APRENDIDA: 2,
  TRAZO_VISUAL: 1,
  OCR_DIRECTO: 0
}

function isCandidateScorePrimary(study) {
  if (!study) return false
  if (
    ['VISION_IA', 'COMBO_RUTINA', 'BUSQUEDA_MANUAL', 'VALIDADO_POR_CONTEXTO'].includes(
      study.origenDeteccion
    )
  ) {
    return true
  }
  const scoreVal = Number(study.score) || 0
  if (study.origenDeteccion === 'TRAZO_VISUAL') {
    return scoreVal >= GENERAL_VISUAL_TRACE_MIN_SCORE
  }
  if (study.origenDeteccion === 'MEMORIA_APRENDIDA') {
    return scoreVal >= GENERAL_MEMORY_MIN_SCORE
  }
  return scoreVal >= GENERAL_DIRECT_MIN_SCORE
}

function isPrimaryGeneralStudy(study) {
  if (!study) return false
  if (study.isSelected) return true
  if (typeof study.hasPrimaryMatch === 'boolean') return study.hasPrimaryMatch
  return !study.isPenalized && isCandidateScorePrimary(study)
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
  const [expandedTracesLines, setExpandedTracesLines] = useState({})
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
  const [isConsultingAi, setIsConsultingAi] = useState(false)
  const [aiConsultMessage, setAiConsultMessage] = useState('')
  const [aiConsultError, setAiConsultError] = useState('')
  const [aiContextInfo, setAiContextInfo] = useState({ diagnostico: '', notasMuestra: '' })
  const [reviewTab, setReviewTab] = useState('general') // 'general' | 'crops'
  const [ocrTrainingEnabled, setOcrTrainingEnabled] = useState(false)
  const [showOtherGeneralOptions, setShowOtherGeneralOptions] = useState(false)
  const [showAiPrivacyAlert, setShowAiPrivacyAlert] = useState(false)
  const [showManualCropSelector, setShowManualCropSelector] = useState(false)
  const [isAddingManualCrop, setIsAddingManualCrop] = useState(false)
  const [manualCropError, setManualCropError] = useState('')

  useEffect(() => {
    let mounted = true
    fetchOcrConfigApi()
      .then((cfg) => {
        if (mounted) {
          setOcrTrainingEnabled(Boolean(cfg?.entrenamientoHabilitado))
        }
      })
      .catch(() => {
        if (mounted) {
          setOcrTrainingEnabled(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const effectiveReviewTab = ocrTrainingEnabled ? reviewTab : 'general'

  // Bloquear scroll del documento subyacente mientras el modal OCR está abierto para evitar doble scrollbar
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [])

  useEffect(() => {
    let mounted = true
    fetchStudiesApi('')
      .then((studies) => {
        if (!mounted || !Array.isArray(studies)) return
        const activeStudies = studies.filter((s) => s?.id && s?.nombre && s.activo)
        setAllCatalogStudies(activeStudies)
        setQuickCatalogStudies(activeStudies.slice(0, 12))
      })
      .catch(() => { })
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

      const initialLines = (res.detectedLinesDetail || []).map((line) => {
        const knownTraceImages =
          Array.isArray(line.imagenesMuestraConocidas) && line.imagenesMuestraConocidas.length > 0
            ? line.imagenesMuestraConocidas.filter(Boolean)
            : line.imagenMuestraConocida
              ? [line.imagenMuestraConocida]
              : []
        const trazosCoincidentes = Array.isArray(line.trazosCoincidentes)
          ? line.trazosCoincidentes
          : []

        return {
          id: line.id,
          texto: line.texto,
          textoOriginalOcr: line.textoOriginalOcr || line.texto,
          textoIa: null,
          confidence: line.confidence || 0,
          bbox: line.bbox || null,
          rowIndex: line.rowIndex || line.id + 1,
          colIndex: line.colIndex || 1,
          totalColsInRow: line.totalColsInRow || 1,
          visualHash: line.visualHash || '',
          cropDataUrl: line.cropDataUrl || null,
          cropStorageDataUrl: line.cropStorageDataUrl || null,
          comboDetectado: line.comboDetectado || null,
          imagenMuestraConocida: line.imagenMuestraConocida || knownTraceImages[0] || null,
          imagenesMuestraConocidas: knownTraceImages,
          trazosCoincidentes,
          traceVotes: {},
          autoTraceVotes: {},
          removedTraceCandidates: {},
          discarded: false,
          isAiDiscovered: false,
          editedInTrainingTab: false,
          candidates: syncTraceStudiesIntoCandidates(
            line.recomendados || [],
            trazosCoincidentes,
            line.texto,
            allCatalogStudies
          ),
          // Mejora 7: ningún estudio preseleccionado por defecto; Admisión debe tildar manualmente
          selectedIds: []
        }
      })

      setOcrResult(res)
      setLinesReview(initialLines)
      setExpandedTracesLines({})
      setExtraContextualStudies([])
      setActiveSearchLineId(null)
      setLineSearchQuery('')
      setAiConsultMessage('')
      setAiConsultError('')
      setAiContextInfo({ diagnostico: '', notasMuestra: '' })
      setReviewTab('general')
      setShowOtherGeneralOptions(false)
      setShowAiPrivacyAlert(false)
      setShowManualCropSelector(false)
      setManualCropError('')
      setShowFloatingAlert(true)
    } catch (err) {
      console.error('Error al procesar receta OCR:', err)
      setOcrError(err.message || 'No se pudo procesar la receta médica.')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleExpandTraces = (lineId) => {
    setExpandedTracesLines((prev) => ({
      ...prev,
      [lineId]: !prev[lineId]
    }))
  }

  // Marcar / desmarcar un estudio dentro de la pestaña Entrenamiento y ponderar automáticamente trazos coincidentes
  const toggleStudyInLine = (lineId, studyId) => {
    let wasUnchecked = false
    setLinesReview((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line
        const exists = line.selectedIds.includes(studyId)
        if (exists) {
          wasUnchecked = true
        }
        const nextSelectedIds = exists
          ? line.selectedIds.filter((id) => id !== studyId)
          : [...line.selectedIds, studyId]
        return {
          ...applyLineSelectionWithAutoTraceVotes(line, nextSelectedIds),
          editedInTrainingTab: ocrTrainingEnabled ? true : line.editedInTrainingTab
        }
      })
    )
    if (wasUnchecked) {
      setExtraContextualStudies((prev) =>
        prev.some((s) => s.id === studyId) ? prev.filter((s) => s.id !== studyId) : prev
      )
    }
  }

  // Votar Bien ('up') o Mal ('down') por un trazo histórico coincidente:
  // si todos los trazos de un estudio se marcan Mal se elimina su estudio; si se marca Bien o se destilda Mal permanece/vuelve sin auto-tildar (Mejora 7).
  const toggleTraceVote = (lineId, recorteId, vote) => {
    if (vote !== 'up' && vote !== 'down') return
    setLinesReview((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line
        const currentVotes = line.traceVotes || {}
        const nextVotes = { ...currentVotes }
        const nextAutoVotes = { ...(line.autoTraceVotes || {}) }
        delete nextAutoVotes[recorteId]
        if (nextVotes[recorteId] === vote) {
          delete nextVotes[recorteId]
        } else {
          nextVotes[recorteId] = vote
        }

        const trazos = Array.isArray(line.trazosCoincidentes) ? line.trazosCoincidentes : []
        const targetTrace = trazos.find((t) => Number(t.recorteId) === Number(recorteId))
        if (!targetTrace || !Array.isArray(targetTrace.estudiosIds)) {
          return {
            ...line,
            traceVotes: nextVotes,
            autoTraceVotes: nextAutoVotes,
            editedInTrainingTab: ocrTrainingEnabled ? true : line.editedInTrainingTab
          }
        }

        let nextCandidates = [...(line.candidates || [])]
        let nextSelectedIds = [...(line.selectedIds || [])]
        const nextRemoved = { ...(line.removedTraceCandidates || {}) }

        targetTrace.estudiosIds.forEach((estId, idx) => {
          const numId = Number(estId)
          if (!numId) return

          const tracesForStudy = trazos.filter(
            (t) =>
              Array.isArray(t.estudiosIds) &&
              t.estudiosIds.some((id) => Number(id) === numId)
          )
          const allDown =
            tracesForStudy.length > 0 &&
            tracesForStudy.every((t) => nextVotes[t.recorteId] === 'down')

          if (allDown) {
            const existingCand = nextCandidates.find((c) => Number(c.id) === numId)
            if (
              existingCand &&
              (existingCand.origenDeteccion === 'MEMORIA_APRENDIDA' ||
                existingCand.origenDeteccion === 'TRAZO_VISUAL')
            ) {
              nextRemoved[numId] = existingCand
              nextCandidates = nextCandidates.filter((c) => Number(c.id) !== numId)
              nextSelectedIds = nextSelectedIds.filter((id) => Number(id) !== numId)
            }
          } else {
            const alreadyExists = nextCandidates.some((c) => Number(c.id) === numId)
            if (!alreadyExists) {
              const restored = nextRemoved[numId]
              if (restored) {
                delete nextRemoved[numId]
                nextCandidates.push(restored)
              } else {
                nextCandidates.push(
                  buildCandidateFromTrace(
                    targetTrace,
                    estId,
                    idx,
                    line.texto,
                    allCatalogStudies
                  )
                )
              }
            }
          }
        })

        return {
          ...line,
          traceVotes: nextVotes,
          autoTraceVotes: nextAutoVotes,
          candidates: nextCandidates,
          selectedIds: nextSelectedIds,
          removedTraceCandidates: nextRemoved,
          editedInTrainingTab: ocrTrainingEnabled ? true : line.editedInTrainingTab
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
      prev.map((line) => {
        if (line.id !== lineId) return line
        if (discarded) {
          const nextVotes = { ...(line.traceVotes || {}) }
          for (const [recId, isAuto] of Object.entries(line.autoTraceVotes || {})) {
            if (isAuto && nextVotes[recId] === 'up') {
              delete nextVotes[recId]
            }
          }
          return {
            ...line,
            discarded: true,
            traceVotes: nextVotes,
            autoTraceVotes: {},
            editedInTrainingTab: ocrTrainingEnabled ? true : line.editedInTrainingTab
          }
        }
        return {
          ...applyLineSelectionWithAutoTraceVotes({ ...line, discarded: false }, line.selectedIds),
          editedInTrainingTab: ocrTrainingEnabled ? true : line.editedInTrainingTab
        }
      })
    )
  }

  // Consultar Gemini IA únicamente con la imagen única recortada/tapada enviada por Admisión
  const handleConfirmContextualAi = async (sanitizedImageDataUrl) => {
    if (!sanitizedImageDataUrl || isConsultingAi) return

    setIsConsultingAi(true)
    setAiConsultMessage('')
    setAiConsultError('')

    try {
      const contextoRenglones = linesReview
        .filter((line) => !line.discarded && !line.isAiDiscovered)
        .map((line) => ({
          indice: line.id,
          texto_ocr: line.textoOriginalOcr || line.texto || '[Manuscrito a revisar]'
        }))

      const res = await interpretContextualRecipeWithAiApi({
        imagenContextual: sanitizedImageDataUrl,
        contextoRenglones
      })

      if (res.errorIa) {
        setAiConsultError(res.errorIa)
        setShowAiPrivacyAlert(false)
        return
      }

      if (res.diagnosticoDetectado || res.notasMuestra) {
        setAiContextInfo({
          diagnostico: res.diagnosticoDetectado || '',
          notasMuestra: res.notasMuestra || ''
        })
      }

      const resultados = Array.isArray(res.resultados) ? res.resultados : []
      const renglonesNuevos = Array.isArray(res.renglonesNuevos) ? res.renglonesNuevos : []
      const porIndice = new Map(resultados.map((item) => [item.indice, item]))

      setLinesReview((prev) => {
        const updatedPrev = prev.map((line) => {
          const item = porIndice.get(line.id)
          if (!item) return line

          const recs = Array.isArray(item.recomendados) ? item.recomendados : []
          const existingMap = new Map(line.candidates.map((c) => [c.id, c]))
          const nextRemoved = { ...(line.removedTraceCandidates || {}) }
          for (const rec of recs) {
            existingMap.set(rec.id, rec)
            delete nextRemoved[rec.id]
          }

          // Mejora 7: no preseleccionar automáticamente al recibir respuesta de Gemini; conservar solo lo tildado
          return {
            ...line,
            textoOriginalOcr: line.textoOriginalOcr || line.texto,
            textoIa: item.textoTranscritoIa || line.textoIa,
            comboDetectado: item.comboDetectado || line.comboDetectado,
            candidates: Array.from(existingMap.values()),
            removedTraceCandidates: nextRemoved,
            selectedIds: line.selectedIds
          }
        })

        if (renglonesNuevos.length === 0) {
          return updatedPrev
        }

        let nextId = updatedPrev.reduce((acc, l) => Math.max(acc, Number(l.id) || 0), -1) + 1
        let nextRowIndex = updatedPrev.reduce((acc, l) => Math.max(acc, Number(l.rowIndex) || 0), 0) + 1

        const appendedLines = renglonesNuevos.map((nuevo) => {
          const recs = Array.isArray(nuevo.recomendados) ? nuevo.recomendados : []
          const textoNuevo = nuevo.textoTranscritoIa || 'Estudio detectado por IA'
          return {
            id: nextId++,
            texto: textoNuevo,
            textoOriginalOcr: textoNuevo,
            textoIa: textoNuevo,
            confidence: 0,
            bbox: null,
            rowIndex: nextRowIndex++,
            colIndex: 1,
            totalColsInRow: 1,
            visualHash: '',
            cropDataUrl: null,
            cropStorageDataUrl: null,
            comboDetectado: nuevo.comboDetectado || null,
            imagenMuestraConocida: null,
            imagenesMuestraConocidas: [],
            trazosCoincidentes: [],
            traceVotes: {},
            autoTraceVotes: {},
            removedTraceCandidates: {},
            discarded: false,
            isAiDiscovered: true,
            editedInTrainingTab: false,
            candidates: recs,
            // Mejora 7: ningún estudio preseleccionado por defecto; Admisión debe tildar manualmente
            selectedIds: []
          }
        })

        return [...updatedPrev, ...appendedLines]
      })

      setShowAiPrivacyAlert(false)

      const modeloLabel = res.modeloUsado || 'Gemini IA'
      const totalResolved =
        resultados.filter((r) => (r.recomendados || []).length > 0).length +
        renglonesNuevos.filter((r) => (r.recomendados || []).length > 0).length

      if (totalResolved > 0) {
        const extraTxt =
          renglonesNuevos.length > 0
            ? ` (${renglonesNuevos.length} renglón(es) adicional(es) recuperado(s))`
            : ''
        setAiConsultMessage(
          `Gemini (${modeloLabel}) sugirió ${totalResolved} estudio(s) en contexto${extraTxt}. Tilde los que correspondan.`
        )
      } else {
        setAiConsultError(
          `Gemini (${modeloLabel}) no pudo identificar estudios del catálogo en la imagen enviada. Revisá o asigná manualmente.`
        )
      }
    } catch (err) {
      console.error('Error al consultar Gemini en contexto:', err)
      setAiConsultError(
        err?.message
          ? `No se pudo consultar a Gemini IA: ${err.message}`
          : 'No se pudo consultar al asistente Gemini IA.'
      )
    } finally {
      setIsConsultingAi(false)
    }
  }

  const clearInlineSearchState = () => {
    setIsSearchingLineStudies(false)
    setLineSearchQuery('')
    setLineSearchResults([])
    setLineSearchError('')
  }

  // Abrir o cerrar el buscador inline de un renglón o de la Vista General
  const handleToggleLineSearch = (lineId) => {
    clearInlineSearchState()
    setActiveSearchLineId((prev) => (prev === lineId ? null : lineId))
  }

  // Cambiar de pestaña cerrando cualquier buscador perteneciente a la otra vista
  const handleSelectReviewTab = (nextTab) => {
    if (nextTab === 'crops' && !ocrTrainingEnabled) {
      return
    }
    setReviewTab(nextTab)
    if (nextTab === 'crops') {
      setShowAiPrivacyAlert(false)
      if (activeSearchLineId === 'general') {
        setActiveSearchLineId(null)
        clearInlineSearchState()
      }
    } else {
      setShowManualCropSelector(false)
      if (activeSearchLineId !== null && activeSearchLineId !== 'general') {
        setActiveSearchLineId(null)
        clearInlineSearchState()
      }
    }
  }

  // Recortar manualmente un estudio faltante en la vista Por Recortes y procesarlo con PaddleOCR + Django local
  const handleConfirmManualCrop = async (normalizedRect) => {
    if (
      !ocrTrainingEnabled ||
      !normalizedRect ||
      isAddingManualCrop ||
      (!imagePreview && !ocrResult?.preprocessedDataUrl)
    ) {
      return
    }

    setIsAddingManualCrop(true)
    setManualCropError('')

    try {
      const detail = await processManualRecipeCrop({
        preprocessedDataUrl: ocrResult?.preprocessedDataUrl,
        fallbackImageUrl: imagePreview,
        normalizedRect
      })

      const nextId = linesReview.reduce((acc, l) => Math.max(acc, Number(l.id) || 0), -1) + 1
      const nextRowIndex =
        linesReview.reduce((acc, l) => Math.max(acc, Number(l.rowIndex) || 0), 0) + 1

      const trazosManuales = Array.isArray(detail.trazosCoincidentes)
        ? detail.trazosCoincidentes
        : []

      const newLine = {
        ...detail,
        id: nextId,
        rowIndex: nextRowIndex,
        colIndex: 1,
        totalColsInRow: 1,
        trazosCoincidentes: trazosManuales,
        traceVotes: {},
        autoTraceVotes: {},
        removedTraceCandidates: {},
        discarded: false,
        isManualCrop: true,
        editedInTrainingTab: true,
        candidates: syncTraceStudiesIntoCandidates(
          detail.recomendados || [],
          trazosManuales,
          detail.texto,
          allCatalogStudies
        ),
        // Mejora 7: ningún estudio preseleccionado por defecto; Admisión debe tildar manualmente
        selectedIds: []
      }

      setLinesReview((prev) => [newLine, ...prev])
      setShowManualCropSelector(false)
      setReviewTab('crops')

      if (newLine.candidates.length === 0) {
        clearInlineSearchState()
        setActiveSearchLineId(nextId)
      }
    } catch (err) {
      console.error('Error al procesar recorte manual:', err)
      setManualCropError(
        err?.message
          ? `No se pudo procesar el recorte manual: ${err.message}`
          : 'No se pudo procesar el recorte manual.'
      )
    } finally {
      setIsAddingManualCrop(false)
    }
  }

  // Agregar y marcar un estudio seleccionado desde el buscador inline o chips rápidos en Entrenamiento
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
        const nextRemoved = { ...(line.removedTraceCandidates || {}) }
        delete nextRemoved[studyFromApi.id]

        return {
          ...applyLineSelectionWithAutoTraceVotes(
            {
              ...line,
              discarded: false,
              candidates: nextCandidates,
              removedTraceCandidates: nextRemoved
            },
            nextSelectedIds
          ),
          editedInTrainingTab: ocrTrainingEnabled ? true : line.editedInTrainingTab
        }
      })
    )
    clearInlineSearchState()
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

  const selectedStudyIdsSet = useMemo(
    () => new Set(allSelectedStudies.map((study) => study.id)),
    [allSelectedStudies]
  )

  // En Vista General excluye todo estudio tildado globalmente; dentro de un renglón,
  // excluye solo los ya tildados en ese mismo renglón para permitir entrenar recortes repetidos.
  const excludedStudyIdsForActiveSearch = useMemo(() => {
    if (!activeSearchLineId || activeSearchLineId === 'general') {
      return selectedStudyIdsSet
    }
    const activeLine = linesReview.find((line) => line.id === activeSearchLineId)
    return new Set(activeLine?.selectedIds || [])
  }, [activeSearchLineId, linesReview, selectedStudyIdsSet])

  const activeLinesCount = useMemo(
    () => linesReview.filter((l) => !l.discarded).length,
    [linesReview]
  )

  const pendingLinesCount = useMemo(
    () => linesReview.filter((l) => !l.discarded && l.selectedIds.length === 0).length,
    [linesReview]
  )

  const existingNormalizedBoxes = useMemo(
    () =>
      normalizeLineBboxes(
        linesReview.filter((l) => !l.discarded),
        ocrResult?.preprocessedWidth,
        ocrResult?.preprocessedHeight,
        0
      ),
    [linesReview, ocrResult]
  )

  // Resultados instantáneos (0 ms) sobre el catálogo en memoria combinados con resultados remotos de alias/baterías,
  // excluyendo según el alcance (global en Vista General, o solo el renglón actual en tarjetas de recorte).
  const displayedLineSearchResults = useMemo(() => {
    const normQuery = normalizeLocalSearchText(lineSearchQuery)
    if (!normQuery) return []

    const merged = []
    const seenIds = new Set()

    for (const study of allCatalogStudies) {
      if (!study?.id || excludedStudyIdsForActiveSearch.has(study.id)) continue
      const normName = normalizeLocalSearchText(study.nombre)
      const normCode = normalizeLocalSearchText(study.codigo_practica)
      if (normName.includes(normQuery) || normCode.includes(normQuery)) {
        seenIds.add(study.id)
        merged.push(study)
        if (merged.length >= 20) break
      }
    }

    for (const remoteStudy of lineSearchResults) {
      if (
        remoteStudy?.id &&
        !seenIds.has(remoteStudy.id) &&
        !excludedStudyIdsForActiveSearch.has(remoteStudy.id)
      ) {
        seenIds.add(remoteStudy.id)
        merged.push(remoteStudy)
      }
    }

    return merged.filter((study) => !excludedStudyIdsForActiveSearch.has(study.id)).slice(0, 25)
  }, [lineSearchQuery, allCatalogStudies, lineSearchResults, excludedStudyIdsForActiveSearch])

  // Vista General deduplicada: consolida todos los estudios sugeridos o tildados sin duplicados
  const uniqueSuggestedStudies = useMemo(() => {
    const mapById = new Map()

    for (const line of linesReview) {
      if (line.discarded) continue
      const rowLabel = line.isManualCrop
        ? 'Recorte manual'
        : line.totalColsInRow > 1
          ? `Fila ${line.rowIndex} · Col. ${line.colIndex}`
          : `Fila ${line.rowIndex}`

      for (const candidate of line.candidates) {
        const isLineSelected = line.selectedIds.includes(candidate.id)
        const linePenalized = isCandidatePenalized(line, candidate)
        const candQualifies = !linePenalized && isCandidateScorePrimary(candidate)
        const existing = mapById.get(candidate.id)
        if (!existing) {
          mapById.set(candidate.id, {
            ...candidate,
            isSelected: isLineSelected,
            isPenalized: linePenalized,
            hasPrimaryMatch: candQualifies,
            lineIds: [line.id],
            rowLabels: [rowLabel]
          })
        } else {
          existing.isSelected = existing.isSelected || isLineSelected
          existing.isPenalized = existing.isPenalized && linePenalized
          if (!existing.lineIds.includes(line.id)) {
            existing.lineIds.push(line.id)
            existing.rowLabels.push(rowLabel)
          }
          const candPri = ORIGIN_PRIORITY[candidate.origenDeteccion] ?? 0
          const existPri = ORIGIN_PRIORITY[existing.origenDeteccion] ?? 0
          if (
            (candQualifies && !existing.hasPrimaryMatch) ||
            (candQualifies === existing.hasPrimaryMatch &&
              (candPri > existPri ||
                (candPri === existPri && (candidate.score || 0) > (existing.score || 0))))
          ) {
            existing.score = candidate.score
            existing.origenDeteccion = candidate.origenDeteccion
          }
          existing.hasPrimaryMatch = existing.hasPrimaryMatch || candQualifies
          existing.vecesConfirmado = Math.max(
            existing.vecesConfirmado || 0,
            candidate.vecesConfirmado || 0
          )
        }
      }
    }

    for (const extra of extraContextualStudies) {
      const existing = mapById.get(extra.id)
      if (!existing) {
        mapById.set(extra.id, {
          ...extra,
          isSelected: true,
          isPenalized: false,
          lineIds: [],
          rowLabels: [
            extra.origenDeteccion === 'BUSQUEDA_MANUAL'
              ? 'Agregado manualmente'
              : 'Sugerencia contextual'
          ]
        })
      } else {
        existing.isSelected = true
      }
    }

    return Array.from(mapById.values()).sort((a, b) => {
      if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1
      const aPri = ORIGIN_PRIORITY[a.origenDeteccion] ?? 0
      const bPri = ORIGIN_PRIORITY[b.origenDeteccion] ?? 0
      if (aPri !== bPri) return bPri - aPri
      return (b.score || 0) - (a.score || 0)
    })
  }, [linesReview, extraContextualStudies])

  const { primaryGeneralStudies, otherGeneralStudies } = useMemo(() => {
    const primary = []
    const other = []
    for (const study of uniqueSuggestedStudies) {
      if (isPrimaryGeneralStudy(study)) {
        primary.push(study)
      } else {
        other.push(study)
      }
    }
    return { primaryGeneralStudies: primary, otherGeneralStudies: other }
  }, [uniqueSuggestedStudies])

  // Asignar y tildar un estudio buscado desde la pestaña Vista General (NO entrena trazos ni alias)
  const handleAssignSearchedStudyToGeneral = (studyFromApi) => {
    if (!studyFromApi?.id) return

    const existingUnique = uniqueSuggestedStudies.find((u) => u.id === studyFromApi.id)
    if (existingUnique && existingUnique.lineIds.length > 0) {
      const primaryLineId = existingUnique.lineIds[0]
      setLinesReview((prev) =>
        prev.map((line) =>
          line.id === primaryLineId && !line.selectedIds.includes(studyFromApi.id)
            ? { ...line, discarded: false, selectedIds: [...line.selectedIds, studyFromApi.id] }
            : line
        )
      )
    } else {
      setExtraContextualStudies((prev) =>
        prev.some((s) => s.id === studyFromApi.id)
          ? prev
          : [
            ...prev,
            {
              id: studyFromApi.id,
              nombre: studyFromApi.nombre,
              categoria: studyFromApi.tipo_muestra || 'Otro',
              codigoPractica: studyFromApi.codigo_practica || '',
              score: 100,
              textoOrigen: 'Búsqueda manual en Vista General',
              origenDeteccion: 'BUSQUEDA_MANUAL',
              preseleccionado: true
            }
          ]
      )
    }

    clearInlineSearchState()
    setActiveSearchLineId((prev) => (prev === 'general' ? 'general' : null))
  }

  // Tildar/destildar desde Vista General (NO agrega traceVotes ni marca entrenamiento; al destildar limpia auto-upvotes huérfanos)
  const toggleStudyInGeneralView = (uniqueItem) => {
    if (!uniqueItem) return
    if (uniqueItem.isSelected) {
      setLinesReview((prev) =>
        prev.map((line) => {
          if (!line.selectedIds.includes(uniqueItem.id)) return line
          const nextSelectedIds = line.selectedIds.filter((id) => id !== uniqueItem.id)
          return applyLineSelectionWithAutoTraceVotes(line, nextSelectedIds, {
            allowAutoUpvotes: false
          })
        })
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
    const merged = []
    const seen = new Set()

    for (const sug of ocrResult?.sugerenciasContextuales || []) {
      if (
        !sug?.id_estudio ||
        selectedStudyIdsSet.has(sug.id_estudio) ||
        seen.has(sug.id_estudio)
      ) {
        continue
      }
      seen.add(sug.id_estudio)
      merged.push({
        id: sug.id_estudio,
        nombre: sug.nombre,
        codigo_practica: sug.codigo_practica || '',
        tipo_muestra: 'Sugerencia'
      })
    }

    for (const cat of quickCatalogStudies) {
      if (!cat?.id || selectedStudyIdsSet.has(cat.id) || seen.has(cat.id)) continue
      seen.add(cat.id)
      merged.push(cat)
      if (merged.length >= 6) break
    }

    return merged.slice(0, 6)
  }, [ocrResult, quickCatalogStudies, selectedStudyIdsSet])

  const handleConfirm = () => {
    const trainedLines = ocrTrainingEnabled
      ? linesReview.filter((line) => Boolean(line.editedInTrainingTab))
      : []

    if (ocrResult && ocrTrainingEnabled && trainedLines.length > 0) {
      const activeConfirmLines = trainedLines.filter(
        (line) => !line.discarded && line.selectedIds.length > 0
      )
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

      const lineasDescartadas = trainedLines
        .filter((line) => line.discarded && (line.textoOriginalOcr || line.texto) !== '[Manuscrito a revisar]')
        .map((line) => line.textoOriginalOcr || line.texto)

      const recortesDescartados = trainedLines
        .filter((line) => line.discarded && (line.cropStorageDataUrl || line.cropDataUrl))
        .map((line) => ({
          texto: line.textoOriginalOcr || line.texto || '',
          imagenMuestra: line.cropStorageDataUrl || line.cropDataUrl || ''
        }))

      const evaluacionesTrazos = []
      for (const line of trainedLines) {
        for (const [recorteIdStr, vote] of Object.entries(line.traceVotes || {})) {
          if (vote !== 'up' && vote !== 'down') continue
          const recorteId = Number(recorteIdStr)
          if (!Number.isInteger(recorteId) || recorteId < 1) continue
          const trace = (line.trazosCoincidentes || []).find(
            (t) => Number(t.recorteId) === recorteId
          )
          evaluacionesTrazos.push({
            recorteId,
            esCorrecto: vote === 'up',
            textoConsulta: line.textoOriginalOcr || line.texto || '',
            firmaVisualConsulta: line.visualHash || '',
            imagenConsulta: line.cropStorageDataUrl || line.cropDataUrl || '',
            estudiosConfirmadosIds: line.discarded ? [] : (line.selectedIds || []),
            scoreBase: trace?.scoreBase ?? null,
            metricas: trace?.metricas || {}
          })
        }
      }

      const hasTrainingPayload =
        renglonesConfirmados.length > 0 ||
        asociacionesDirectas.length > 0 ||
        lineasDescartadas.length > 0 ||
        recortesDescartados.length > 0 ||
        evaluacionesTrazos.length > 0

      if (hasTrainingPayload) {
        reportOcrFeedbackApi({
          lineasOrigen: ocrResult.detectedLines || [],
          estudiosConfirmadosIds: allSelectedStudies.map((s) => s.id),
          asociacionesDirectas,
          renglonesConfirmados,
          lineasDescartadas,
          recortesDescartados,
          evaluacionesTrazos
        }).catch((err) => {
          console.warn('Feedback OCR no crítico falló:', err)
        })
      }
    }

    onConfirmStudies(allSelectedStudies)
    onClose()
  }

  const renderInlineSearchBox = (searchTargetId, onSelectStudy) => {
    const isGeneralSearch = searchTargetId === 'general'
    const targetLine = isGeneralSearch
      ? null
      : linesReview.find((line) => line.id === searchTargetId)
    const excludedIds = isGeneralSearch
      ? selectedStudyIdsSet
      : new Set(targetLine?.selectedIds || [])
    const filteredResults = displayedLineSearchResults.filter(
      (study) => !excludedIds.has(study.id)
    )

    return (
      <div className="ocr-modal__line-search-box">
        <div className="ocr-modal__line-search-input-wrap">
          <Search size={14} className="ocr-modal__line-search-icon" />
          <input
            key={`search-${searchTargetId}`}
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
              if (e.key === 'Enter' && filteredResults.length > 0) {
                e.preventDefault()
                onSelectStudy(filteredResults[0])
              }
            }}
            autoFocus
            autoComplete="off"
          />
        </div>

        {lineSearchQuery.trim() && (
          <div className="ocr-modal__line-search-dropdown">
            {filteredResults.length === 0 && isSearchingLineStudies ? (
              <div className="ocr-modal__line-search-status">
                Buscando en catálogo y memoria...
              </div>
            ) : lineSearchError && filteredResults.length === 0 ? (
              <div className="ocr-modal__line-search-status ocr-modal__line-search-status--error">
                {lineSearchError}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="ocr-modal__line-search-status">
                No se encontraron estudios disponibles sin marcar para &quot;{lineSearchQuery.trim()}&quot;.
              </div>
            ) : (
              <ul className="ocr-modal__line-search-results">
                {filteredResults.map((study) => {
                  const isSelectedInAnotherLine =
                    !isGeneralSearch && selectedStudyIdsSet.has(study.id)

                  return (
                    <li key={study.id}>
                      <button
                        type="button"
                        className="ocr-modal__line-search-result-btn"
                        onClick={() => onSelectStudy(study)}
                      >
                        <span className="ocr-modal__line-search-result-main">
                          <Plus size={13} />
                          <span>{study.nombre}</span>
                        </span>
                        {(isSelectedInAnotherLine || study.codigo_practica) && (
                          <span className="ocr-modal__line-search-result-aside">
                            {isSelectedInAnotherLine && (
                              <span className="ocr-modal__line-search-result-badge">
                                En otro renglón · suma entrenamiento
                              </span>
                            )}
                            {study.codigo_practica && (
                              <span className="ocr-modal__line-search-result-meta">
                                {study.codigo_practica}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    )
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
                        ? effectiveReviewTab === 'crops'
                          ? `— Tilde manualmente los estudios que correspondan (${pendingLinesCount} renglón(es) sin marcar)`
                          : '— Tilde manualmente los estudios solicitados en la receta'
                        : effectiveReviewTab === 'crops' && pendingLinesCount > 0
                          ? `— ${pendingLinesCount} renglón(es) sin estudio asignado; tilde o descarte según corresponda`
                          : '— Verifique las prácticas tildadas antes de confirmar'}
                    </span>
                  </div>
                </div>

                {/* Pestañas: Vista General (principal) vs Entrenamiento bloqueable por Jefatura */}
                <div className="ocr-modal__tabs" role="tablist" aria-label="Modo de revisión OCR">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveReviewTab === 'general'}
                    className={`ocr-modal__tab-btn ${effectiveReviewTab === 'general' ? 'ocr-modal__tab-btn--active' : ''}`}
                    onClick={() => handleSelectReviewTab('general')}
                  >
                    <ListChecks size={14} />
                    <span>Vista General ({primaryGeneralStudies.length})</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveReviewTab === 'crops'}
                    aria-disabled={!ocrTrainingEnabled}
                    disabled={!ocrTrainingEnabled}
                    className={`ocr-modal__tab-btn ${effectiveReviewTab === 'crops' ? 'ocr-modal__tab-btn--active' : ''
                      } ${!ocrTrainingEnabled ? 'ocr-modal__tab-btn--locked' : ''}`}
                    onClick={() => handleSelectReviewTab('crops')}
                    title={
                      ocrTrainingEnabled
                        ? 'Modo Entrenamiento y Debug por recortes'
                        : 'Bloqueado: solo disponible si Jefatura habilita el modo Entrenamiento OCR'
                    }
                  >
                    {ocrTrainingEnabled ? <Layers size={14} /> : <Lock size={13} />}
                    <span>
                      {ocrTrainingEnabled
                        ? `Entrenamiento (${activeLinesCount})`
                        : 'Entrenamiento (Bloqueado)'}
                    </span>
                  </button>
                </div>

                {effectiveReviewTab === 'crops' && ocrTrainingEnabled && (linesReview.length > 0 || imagePreview) && (
                  <div className="ocr-modal__ai-batch-bar">
                    <div className="ocr-modal__ai-batch-info">
                      <span>
                        {linesReview.length > 0
                          ? '🔒 Privacidad: recortá datos del paciente y tapá firma/sello en blanco antes de enviar la receta en contexto a Gemini IA.'
                          : 'Si PaddleOCR no detectó renglones, podés recortar un estudio manualmente o consultar la orden en contexto con Gemini IA.'}
                      </span>
                      {aiConsultMessage && (
                        <strong className="ocr-modal__ai-batch-status">{aiConsultMessage}</strong>
                      )}
                    </div>
                    <div className="ocr-modal__general-bar-actions">
                      <button
                        type="button"
                        className={`ocr-modal__manual-crop-btn ${showManualCropSelector ? 'ocr-modal__manual-crop-btn--active' : ''
                          }`}
                        disabled={!imagePreview || isAddingManualCrop || isConsultingAi}
                        onClick={() => {
                          setManualCropError('')
                          setShowAiPrivacyAlert(false)
                          setShowManualCropSelector((prev) => !prev)
                        }}
                        title="Dibujar manualmente sobre la receta un renglón o estudio que faltó"
                      >
                        <Crop size={14} />
                        <span>
                          {showManualCropSelector ? 'Cerrar recorte manual' : '+ Agregar recorte'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ocr-modal__ai-batch-btn"
                        disabled={!imagePreview || isConsultingAi || isAddingManualCrop}
                        onClick={() => {
                          setAiConsultError('')
                          setShowManualCropSelector(false)
                          setShowAiPrivacyAlert((prev) => !prev)
                        }}
                      >
                        <Sparkles size={14} />
                        <span>
                          {isConsultingAi
                            ? 'Consultando Gemini...'
                            : showAiPrivacyAlert
                              ? 'Cerrar editor IA'
                              : '✨ Escanear con IA (en contexto)'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {effectiveReviewTab === 'general' && (
                  <div className="ocr-modal__ai-batch-bar">
                    <div className="ocr-modal__ai-batch-info">
                      <span>
                        Sugerencias de alta confianza sin duplicados. Tildá los estudios solicitados o consultá con IA.
                      </span>
                      {aiConsultMessage && (
                        <strong className="ocr-modal__ai-batch-status">{aiConsultMessage}</strong>
                      )}
                    </div>
                    <div className="ocr-modal__general-bar-actions">
                      <button
                        type="button"
                        className={`ocr-modal__line-search-toggle ${activeSearchLineId === 'general' ? 'ocr-modal__line-search-toggle--active' : ''
                          }`}
                        onClick={() => handleToggleLineSearch('general')}
                        title="Buscar y agregar un estudio en Vista General"
                      >
                        <Search size={13} />
                        <span>
                          {activeSearchLineId === 'general' ? 'Cerrar buscador' : 'Buscar estudio'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ocr-modal__ai-batch-btn"
                        disabled={!imagePreview || isConsultingAi}
                        onClick={() => {
                          setAiConsultError('')
                          setShowAiPrivacyAlert((prev) => !prev)
                        }}
                      >
                        <Sparkles size={14} />
                        <span>
                          {isConsultingAi
                            ? 'Consultando Gemini...'
                            : showAiPrivacyAlert
                              ? 'Cerrar editor IA'
                              : '✨ Escanear con IA (en contexto)'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {aiConsultError && (
                  <div className="ocr-modal__ai-error-alert" role="alert">
                    <AlertCircle size={16} />
                    <span>{aiConsultError}</span>
                  </div>
                )}

                {manualCropError && (
                  <div className="ocr-modal__ai-error-alert" role="alert">
                    <AlertCircle size={16} />
                    <span>{manualCropError}</span>
                  </div>
                )}

                {(aiContextInfo.diagnostico || aiContextInfo.notasMuestra) && (
                  <div className="ocr-modal__ai-context-banner">
                    <Sparkles size={14} />
                    <span>
                      <strong>Contexto leído por Gemini:</strong>{' '}
                      {[
                        aiContextInfo.diagnostico ? `Diagnóstico: ${aiContextInfo.diagnostico}` : '',
                        aiContextInfo.notasMuestra ? `Muestra: ${aiContextInfo.notasMuestra}` : ''
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                )}

                {showManualCropSelector && ocrTrainingEnabled && imagePreview && (
                  <div className="ocr-modal__manual-crop-panel">
                    <RecipeManualCropSelector
                      originalImageSrc={imagePreview}
                      processedImageSrc={ocrResult?.preprocessedDataUrl || ''}
                      existingBoxes={existingNormalizedBoxes}
                      isProcessing={isAddingManualCrop}
                      onCancel={() => setShowManualCropSelector(false)}
                      onConfirmCrop={handleConfirmManualCrop}
                    />
                  </div>
                )}

                {showAiPrivacyAlert && imagePreview && (
                  <div className="ocr-modal__privacy-guard">
                    <RecipeAiRedactionEditor
                      imageSrc={imagePreview}
                      isSubmitting={isConsultingAi}
                      onCancel={() => setShowAiPrivacyAlert(false)}
                      onConfirm={handleConfirmContextualAi}
                    />
                  </div>
                )}

                {effectiveReviewTab === 'general' ? (
                  <div className="ocr-modal__general-view">
                    {activeSearchLineId === 'general' &&
                      renderInlineSearchBox('general', handleAssignSearchedStudyToGeneral)}

                    {primaryGeneralStudies.length > 0 ? (
                      <div className="ocr-modal__studies-grid">
                        {primaryGeneralStudies.map((study) => (
                          <label
                            key={`gen-${study.id}`}
                            className={`ocr-modal__study-item ${study.isSelected ? 'ocr-modal__study-item--selected' : ''
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
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="ocr-modal__no-studies-msg">
                        <AlertCircle size={16} />
                        <span>
                          {otherGeneralStudies.length > 0
                            ? `No hubo coincidencias de alta confianza (>= ${GENERAL_VISUAL_TRACE_MIN_SCORE}% trazo visual, >= ${GENERAL_MEMORY_MIN_SCORE}% memoria de texto o >= ${GENERAL_DIRECT_MIN_SCORE}% directa). Revisá "Mostrar otras opciones", usá "Buscar estudio" o "Escanear con IA".`
                            : 'Todavía no hay estudios sugeridos. Usá "Buscar estudio" o "Escanear con IA (en contexto)".'}
                        </span>
                      </div>
                    )}

                    {otherGeneralStudies.length > 0 && (
                      <div className="ocr-modal__other-options-wrap">
                        <button
                          type="button"
                          className="ocr-modal__other-options-toggle"
                          aria-expanded={showOtherGeneralOptions}
                          onClick={() => setShowOtherGeneralOptions((prev) => !prev)}
                        >
                          {showOtherGeneralOptions ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                          <span>
                            {showOtherGeneralOptions
                              ? `Ocultar otras opciones (${otherGeneralStudies.length})`
                              : `Mostrar otras opciones (${otherGeneralStudies.length})`}
                          </span>
                        </button>

                        {showOtherGeneralOptions && (
                          <div className="ocr-modal__other-options-section">
                            <div className="ocr-modal__studies-grid">
                              {otherGeneralStudies.map((study) => (
                                <label
                                  key={`gen-other-${study.id}`}
                                  className={`ocr-modal__study-item ocr-modal__study-item--secondary ${study.isSelected ? 'ocr-modal__study-item--selected' : ''
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
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
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
                          className={`ocr-modal__line-card ${hasSelected
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
                                    {line.isManualCrop
                                      ? 'Recorte manual'
                                      : line.totalColsInRow > 1
                                        ? `Fila ${line.rowIndex} · Col. ${line.colIndex}`
                                        : `Fila ${line.rowIndex}`}
                                  </span>
                                  <span className="ocr-modal__line-label">Renglón:</span>
                                  <span className="ocr-modal__line-text">{line.texto}</span>
                                </div>
                                <div className="ocr-modal__line-badges">
                                  {line.isManualCrop && (
                                    <span className="ocr-modal__origin-badge ocr-modal__origin-badge--manual">
                                      ✂️ Recorte manual
                                    </span>
                                  )}
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
                                  {line.isAiDiscovered && (
                                    <span className="ocr-modal__origin-badge ocr-modal__origin-badge--vision">
                                      ✨ Recuperado en contexto
                                    </span>
                                  )}
                                  {line.textoIa && !line.isAiDiscovered && (
                                    <span className="ocr-modal__origin-badge ocr-modal__origin-badge--vision">
                                      ✨ IA leyó: {line.textoIa}
                                    </span>
                                  )}
                                  {(!line.trazosCoincidentes || line.trazosCoincidentes.length === 0) &&
                                    line.imagenesMuestraConocidas?.length > 0 && (
                                      <div
                                        className="ocr-modal__known-trace-pill"
                                        title={
                                          line.imagenesMuestraConocidas.length > 1
                                            ? `Coincide con ${line.imagenesMuestraConocidas.length} recortes manuscritos guardados previamente`
                                            : 'Coincide con un recorte manuscrito guardado previamente'
                                        }
                                      >
                                        <div className="ocr-modal__known-trace-thumbs">
                                          {line.imagenesMuestraConocidas.map((imgSrc, imgIdx) => (
                                            <img
                                              key={`${line.id}-trace-${imgIdx}`}
                                              src={imgSrc}
                                              alt={`Trazo coincidente previo ${imgIdx + 1}`}
                                              className="ocr-modal__known-trace-thumb"
                                            />
                                          ))}
                                        </div>
                                        <span>
                                          {line.imagenesMuestraConocidas.length > 1
                                            ? `Trazos históricos coincidentes (${line.imagenesMuestraConocidas.length})`
                                            : 'Trazo histórico coincidente'}
                                        </span>
                                      </div>
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
                                className={`ocr-modal__line-search-toggle ${isSearchOpen ? 'ocr-modal__line-search-toggle--active' : ''
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
                          {isSearchOpen &&
                            renderInlineSearchBox(line.id, (study) =>
                              handleAssignSearchedStudyToLine(line.id, study)
                            )}

                          {/* Trazos históricos coincidentes evaluables (Bien / Mal) */}
                          {line.trazosCoincidentes?.length > 0 && (() => {
                            const totalTraces = line.trazosCoincidentes.length
                            const isTracesExpanded = Boolean(expandedTracesLines[line.id])
                            const visibleTraces = isTracesExpanded
                              ? line.trazosCoincidentes
                              : line.trazosCoincidentes.slice(0, INITIAL_VISIBLE_TRACES)
                            const hiddenTracesCount = Math.max(0, totalTraces - visibleTraces.length)

                            return (
                              <div className="ocr-modal__matched-traces">
                                <div className="ocr-modal__matched-traces-header">
                                  Trazos históricos coincidentes ({totalTraces}) — marcá si coinciden:
                                </div>
                                <div className="ocr-modal__matched-traces-list">
                                  {visibleTraces.map((trace) => {
                                    const currentVote = line.traceVotes?.[trace.recorteId]
                                    const studyNames =
                                      Array.isArray(trace.estudiosNombres) && trace.estudiosNombres.length > 0
                                        ? trace.estudiosNombres.join(', ')
                                        : 'Estudio asociado'

                                    return (
                                      <div
                                        key={`${line.id}-matched-trace-${trace.recorteId}`}
                                        className={`ocr-modal__trace-chip ${currentVote === 'up'
                                            ? 'ocr-modal__trace-chip--good'
                                            : currentVote === 'down'
                                              ? 'ocr-modal__trace-chip--bad'
                                              : ''
                                          }`}
                                      >
                                        {trace.imagenMuestra && (
                                          <img
                                            src={trace.imagenMuestra}
                                            alt={`Trazo histórico de ${studyNames}`}
                                            className="ocr-modal__trace-thumb"
                                          />
                                        )}
                                        <div className="ocr-modal__trace-info">
                                          <span className="ocr-modal__trace-study" title={studyNames}>
                                            {studyNames}
                                          </span>
                                          <span className="ocr-modal__trace-score">
                                            {Math.round(Number(trace.similitudScore) || 0)}%
                                          </span>
                                        </div>
                                        <div className="ocr-modal__trace-actions">
                                          <button
                                            type="button"
                                            aria-pressed={currentVote === 'up'}
                                            className={`ocr-modal__trace-vote-btn ocr-modal__trace-vote-btn--good ${currentVote === 'up' ? 'ocr-modal__trace-vote-btn--active' : ''
                                              }`}
                                            onClick={() => toggleTraceVote(line.id, trace.recorteId, 'up')}
                                            title="Marcar trazo como coincidencia correcta"
                                          >
                                            <Check size={12} />
                                            <span>Bien</span>
                                          </button>
                                          <button
                                            type="button"
                                            aria-pressed={currentVote === 'down'}
                                            className={`ocr-modal__trace-vote-btn ocr-modal__trace-vote-btn--bad ${currentVote === 'down' ? 'ocr-modal__trace-vote-btn--active' : ''
                                              }`}
                                            onClick={() => toggleTraceVote(line.id, trace.recorteId, 'down')}
                                            title="Marcar trazo como coincidencia errónea"
                                          >
                                            <X size={12} />
                                            <span>Mal</span>
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                {totalTraces > INITIAL_VISIBLE_TRACES && (
                                  <button
                                    type="button"
                                    className="ocr-modal__traces-toggle-btn"
                                    onClick={() => toggleExpandTraces(line.id)}
                                    aria-expanded={isTracesExpanded}
                                  >
                                    {isTracesExpanded
                                      ? `Ver menos (mostrar ${INITIAL_VISIBLE_TRACES})`
                                      : `Ver todos (${totalTraces}) · +${hiddenTracesCount} más`}
                                  </button>
                                )}
                              </div>
                            )
                          })()}

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
                            (() => {
                              const sortedCandidates = line.candidates
                                .map((study, idx) => ({
                                  study,
                                  idx,
                                  penalized: isCandidatePenalized(line, study)
                                }))
                                .sort((a, b) => {
                                  if (a.penalized !== b.penalized) return a.penalized ? 1 : -1
                                  return a.idx - b.idx
                                })

                              return (
                                <div className="ocr-modal__studies-grid">
                                  {sortedCandidates.map(({ study, penalized }) => {
                                    const isSelected = line.selectedIds.includes(study.id)

                                    return (
                                      <label
                                        key={`${line.id}-${study.id}`}
                                        className={`ocr-modal__study-item ${isSelected ? 'ocr-modal__study-item--selected' : ''
                                          } ${penalized ? 'ocr-modal__study-item--penalized' : ''}`}
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
                                            {penalized && (
                                              <span className="ocr-modal__penalized-tag">
                                                Trazo marcado como erróneo
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </label>
                                    )
                                  })}
                                </div>
                              )
                            })()
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

                {/* Prácticas agregadas manualmente o desde sugerencias contextuales */}
                {extraContextualStudies.length > 0 && (
                  <div className="ocr-modal__extra-contextual-list">
                    <span className="ocr-modal__extra-contextual-title">
                      Agregados desde sugerencias o búsqueda:
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
                    (sug) => !selectedStudyIdsSet.has(sug.id_estudio)
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
                  setAiConsultMessage('')
                  setAiConsultError('')
                  setAiContextInfo({ diagnostico: '', notasMuestra: '' })
                  setReviewTab('general')
                  setShowOtherGeneralOptions(false)
                  setShowAiPrivacyAlert(false)
                  setShowManualCropSelector(false)
                  setManualCropError('')
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
