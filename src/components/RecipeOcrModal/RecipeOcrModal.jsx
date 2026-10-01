import React, { useState } from 'react'
import { Camera, Upload, Check, X, Sparkles, FileText, AlertCircle } from 'lucide-react'
import { scanRecipeOcrApi } from '../../services/ocrService'
import './RecipeOcrModal.css'

export default function RecipeOcrModal({ onClose, onConfirmStudies }) {
  const [file, setFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [ocrError, setOcrError] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [selectedStudyNames, setSelectedStudyNames] = useState([])

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setImagePreview(URL.createObjectURL(selected))
      setOcrError(null)
    }
  }

  const handleProcessOcr = async () => {
    if (!file) return
    setAnalyzing(true)
    setOcrError(null)
    try {
      const res = await scanRecipeOcrApi(file)
      setOcrResult(res)
      const names = (res.suggestedStudies || []).map((s) => s.nombre || s.categoria)
      setSelectedStudyNames(Array.from(new Set(names)))
    } catch (err) {
      console.error('Error al procesar receta OCR:', err)
      setOcrError(err.message || 'No se pudo conectar con el microservicio OCR.')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleStudy = (studyName) => {
    setSelectedStudyNames((prev) =>
      prev.includes(studyName) ? prev.filter((c) => c !== studyName) : [...prev, studyName]
    )
  }

  const handleConfirm = () => {
    onConfirmStudies(selectedStudyNames)
    onClose()
  }

  return (
    <div className="ocr-modal">
      <div className="ocr-modal__card">
        <button className="ocr-modal__close-btn" onClick={onClose} aria-label="Cerrar modal">
          <X size={20} />
        </button>

        <div className="ocr-modal__header">
          <div className="ocr-modal__chip-ai">
            <Sparkles size={16} />
            <span>IA Institucional (Microservicio OCR)</span>
          </div>
          <h3 className="ocr-modal__title">Escaneo y Reconocimiento de Receta Médica</h3>
          <p className="ocr-modal__subtitle">
            Procesamiento seguro en memoria volátil de la red institucional sin persistencia en disco (Cumplimiento PHI).
          </p>
        </div>

        {ocrError && (
          <div className="ocr-modal__error-alert" style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', alignItems: 'center' }}>
            <AlertCircle size={18} />
            <span>{ocrError}</span>
          </div>
        )}

        {!ocrResult ? (
          <div className="ocr-modal__step-upload">
            {imagePreview ? (
              <div className="ocr-modal__preview-container">
                <img src={imagePreview} alt="Receta médica" className="ocr-modal__preview-image" />
                <button className="ocr-modal__reupload-btn" onClick={() => setImagePreview(null)}>
                  Cambiar imagen
                </button>
              </div>
            ) : (
              <div className="ocr-modal__dropzone">
                <Camera size={44} className="ocr-modal__dropzone-icon" />
                <p className="ocr-modal__dropzone-text">Arrastre o seleccione una fotografía de la orden médica</p>
                <div className="ocr-modal__dropzone-buttons">
                  <label className="ocr-modal__browse-btn">
                    <Upload size={16} />
                    Subir archivo
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            )}

            <div className="ocr-modal__actions">
              <button
                className="ocr-modal__run-btn"
                disabled={!imagePreview || analyzing}
                onClick={handleProcessOcr}
              >
                {analyzing ? (
                  <>
                    <span className="ocr-modal__spinner" />
                    Segmentando texto manuscrito con OCR...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Procesar y Extraer Estudios
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="ocr-modal__step-review">
            <div className="ocr-modal__alert">
              <Check size={18} className="ocr-modal__alert-icon" />
              <div className="ocr-modal__alert-content">
                <strong>Revisión Humana Asistida (Human-in-the-Loop)</strong>
                <p>
                  {ocrResult.totalSugerencias > 0
                    ? `Se detectaron ${ocrResult.totalSugerencias} prácticas sugeridas. Modifique o confirme los estudios antes de emitir el ticket:`
                    : 'No se detectaron estudios coincidentes en la orden. Puede agregarlos manualmente en el formulario.'}
                </p>
              </div>
            </div>

            <div className="ocr-modal__studies-grid">
              {(ocrResult.suggestedStudies && ocrResult.suggestedStudies.length > 0
                ? ocrResult.suggestedStudies.map((s) => s.nombre)
                : ['Hemograma', 'Bioquímica', 'Orina', 'Cultivo', 'Otro']
              ).map((studyItem) => {
                const isSelected = selectedStudyNames.includes(studyItem)
                return (
                  <label
                    key={studyItem}
                    className={`ocr-modal__study-item ${isSelected ? 'ocr-modal__study-item--selected' : ''}`}
                    onClick={() => toggleStudy(studyItem)}
                  >
                    <input type="checkbox" className="ocr-modal__study-checkbox" checked={isSelected} readOnly />
                    <span className="ocr-modal__study-name">{studyItem}</span>
                  </label>
                )
              })}
            </div>

            <div className="ocr-modal__actions">
              <button className="ocr-modal__confirm-btn" onClick={handleConfirm}>
                Confirmar Estudios ({selectedStudyNames.length})
              </button>
              <button className="ocr-modal__cancel-btn" onClick={() => setOcrResult(null)}>
                Volver a escanear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
