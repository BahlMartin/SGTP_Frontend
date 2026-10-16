import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera,
  Upload,
  Check,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  VideoOff,
  ClipboardPaste,
  Eye,
  SlidersHorizontal,
  Plus
} from 'lucide-react'
import { processRecipeFullFlow } from '../../services/ocrService'
import { fetchStudiesApi } from '../../services/studyService'
import './RecipeOcrModal.css'

export default function RecipeOcrModal({ onClose, onConfirmStudies }) {
  // Estados de captura de imagen
  const [file, setFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'camera'
  const [viewMode, setViewMode] = useState('original') // 'original' | 'processed'

  // Estados de Cámara Web
  const [cameraDevices, setCameraDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Estados de Procesamiento OCR
  const [analyzing, setAnalyzing] = useState(false)
  const [progressInfo, setProgressInfo] = useState({ percent: 0, message: '' })
  const [ocrError, setOcrError] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [selectedStudies, setSelectedStudies] = useState([])

  // Estado para agregar estudios faltantes manualmente
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearchingManual, setIsSearchingManual] = useState(false)
  const [showManualSearch, setShowManualSearch] = useState(false)

  // Detener la cámara al desmontar
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Detectar cámaras disponibles
  useEffect(() => {
    async function getDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices.filter((device) => device.kind === 'videoinput')
        setCameraDevices(videoInputs)
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId)
        }
      } catch (err) {
        console.warn('Error al enumerar dispositivos de video:', err)
      }
    }
    getDevices()
  }, [selectedDeviceId])

  // Iniciar Stream de Cámara Web
  const startCamera = async (deviceId = selectedDeviceId) => {
    stopCamera()
    setCameraError(null)
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err)
      setCameraError('No se pudo acceder a la cámara. Verifique los permisos del navegador.')
    }
  }

  // Capturar fotograma de la cámara
  const handleCaptureFrame = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], 'captura_receta_camara.jpg', { type: 'image/jpeg' })
        setFile(capturedFile)
        setImagePreview(URL.createObjectURL(blob))
        stopCamera()
        setActiveTab('upload')
      }
    }, 'image/jpeg', 0.95)
  }

  // Manejar subida o arrastre de archivo
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setImagePreview(URL.createObjectURL(selected))
      setOcrError(null)
      stopCamera()
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
          stopCamera()
          setActiveTab('upload')
          break
        }
      }
    }
  }, [stopCamera])

  useEffect(() => {
    window.addEventListener('paste', handlePasteEvent)
    return () => {
      window.removeEventListener('paste', handlePasteEvent)
    }
  }, [handlePasteEvent])

  // Iniciar procesamiento completo (Canvas Otsu -> Tesseract.js -> Django Mapeo)
  const handleProcessOcr = async () => {
    if (!file && !imagePreview) return
    setAnalyzing(true)
    setOcrError(null)
    setProgressInfo({ percent: 5, message: 'Iniciando filtro de preprocesamiento...' })

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

  // Búsqueda manual de estudios faltantes
  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingManual(true)
      try {
        const studies = await fetchStudiesApi(query)
        setSearchResults(studies.filter((s) => s?.id && s.activo))
      } catch (e) {
        console.error('Error al buscar estudio complementario:', e)
      } finally {
        setIsSearchingManual(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleAddManualStudy = (study) => {
    if (!selectedStudies.some((s) => s.id === study.id)) {
      setSelectedStudies((prev) => [
        ...prev,
        {
          id: study.id,
          nombre: study.nombre,
          categoria: study.tipo_muestra || 'Otro',
          codigoPractica: study.codigo_practica,
          score: 100,
          textoOrigen: 'Agregado manualmente'
        }
      ])
    }
    setSearchQuery('')
    setShowManualSearch(false)
  }

  const handleConfirm = () => {
    onConfirmStudies(selectedStudies)
    stopCamera()
    onClose()
  }

  return (
    <div className="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title">
      <div className="ocr-modal__card">
        <button
          className="ocr-modal__close-btn"
          onClick={() => {
            stopCamera()
            onClose()
          }}
          aria-label="Cerrar ventana de escaneo"
        >
          <X size={20} />
        </button>

        <div className="ocr-modal__header">
          <div className="ocr-modal__chip-ai">
            <Sparkles size={16} />
            <span>OCR Institucional Seguro (Tesseract.js + Canvas)</span>
          </div>
          <h3 id="ocr-modal-title" className="ocr-modal__title">
            Escaneo y Reconocimiento de Receta Médica
          </h3>
          <p className="ocr-modal__subtitle">
            Procesamiento en memoria volátil de la PC local (Cumplimiento PHI). La imagen nunca viaja a internet.
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
            {/* Pestañas de Método de Captura */}
            <div className="ocr-modal__tabs">
              <button
                type="button"
                className={`ocr-modal__tab ${activeTab === 'upload' ? 'ocr-modal__tab--active' : ''}`}
                onClick={() => {
                  stopCamera()
                  setActiveTab('upload')
                }}
              >
                <Upload size={16} />
                Subir o Pegar (Ctrl + V)
              </button>
              <button
                type="button"
                className={`ocr-modal__tab ${activeTab === 'camera' ? 'ocr-modal__tab--active' : ''}`}
                onClick={() => {
                  setActiveTab('camera')
                  startCamera()
                }}
              >
                <Camera size={16} />
                Cámara Web en Vivo
              </button>
            </div>

            {/* Vista 1: Subir Archivo o Vista Previa */}
            {activeTab === 'upload' && (
              <>
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
                      Cambiar o volver a capturar imagen
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
              </>
            )}

            {/* Vista 2: Cámara Web en Vivo */}
            {activeTab === 'camera' && (
              <div className="ocr-modal__camera-container">
                {cameraError ? (
                  <div className="ocr-modal__error-alert">
                    <VideoOff size={18} />
                    <span>{cameraError}</span>
                  </div>
                ) : (
                  <>
                    <div className="ocr-modal__video-wrapper">
                      <video ref={videoRef} autoPlay playsInline className="ocr-modal__video-feed" />
                      {/* Marco guía para encuadrar la orden médica */}
                      <div className="ocr-modal__guide-overlay">
                        <div className="ocr-modal__guide-box">
                          <span>Alinee la orden médica dentro de este marco</span>
                        </div>
                      </div>
                    </div>

                    <div className="ocr-modal__camera-controls">
                      {cameraDevices.length > 1 && (
                        <select
                          className="ocr-modal__camera-select"
                          value={selectedDeviceId}
                          onChange={(e) => {
                            setSelectedDeviceId(e.target.value)
                            startCamera(e.target.value)
                          }}
                        >
                          {cameraDevices.map((d, index) => (
                            <option key={d.deviceId || index} value={d.deviceId}>
                              {d.label || `Cámara ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        className="ocr-modal__capture-btn"
                        onClick={handleCaptureFrame}
                      >
                        <Camera size={18} />
                        Capturar Foto de la Receta
                      </button>
                    </div>
                  </>
                )}
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
                    Procesando receta con Tesseract.js...
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
                    : 'No se detectaron estudios coincidentes automáticamente. Puede agregar prácticas manualmente abajo.'}
                </p>
              </div>
            </div>

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
                    Confianza OCR: {Math.round(ocrResult.confidence)}%
                  </span>
                )}
              </div>
            </div>

            {/* Grilla de Prácticas Detectadas */}
            {ocrResult.suggestedStudies?.length > 0 && (
              <div className="ocr-modal__studies-grid">
                {ocrResult.suggestedStudies.map((study) => {
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
                          {scoreNumber > 0 && (
                            <span
                              className={`ocr-modal__study-score ${
                                scoreNumber >= 85 ? 'ocr-modal__study-score--high' : 'ocr-modal__study-score--medium'
                              }`}
                            >
                              {scoreNumber}% coincidencia
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Buscador para agregar estudios adicionales manualmente */}
            <div className="ocr-modal__manual-section">
              {!showManualSearch ? (
                <button
                  type="button"
                  className="ocr-modal__add-study-btn"
                  onClick={() => setShowManualSearch(true)}
                >
                  <Plus size={15} />
                  ¿Faltó algún estudio? Agregar del catálogo
                </button>
              ) : (
                <div className="ocr-modal__manual-search-box">
                  <div className="ocr-modal__manual-input-wrapper">
                    <input
                      type="search"
                      placeholder="Escriba para buscar práctica del catálogo..."
                      className="ocr-modal__manual-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="ocr-modal__manual-cancel"
                      onClick={() => {
                        setShowManualSearch(false)
                        setSearchQuery('')
                      }}
                    >
                      Cancelar
                    </button>
                  </div>

                  {isSearchingManual && (
                    <div className="ocr-modal__manual-status">Buscando en catálogo...</div>
                  )}

                  {searchResults.length > 0 && (
                    <ul className="ocr-modal__manual-results">
                      {searchResults.map((st) => (
                        <li key={st.id}>
                          <button
                            type="button"
                            className="ocr-modal__manual-result-item"
                            onClick={() => handleAddManualStudy(st)}
                          >
                            <Plus size={14} />
                            <span>{st.nombre}</span>
                            <small>({st.codigo_practica})</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

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
                Volver a Escanear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
