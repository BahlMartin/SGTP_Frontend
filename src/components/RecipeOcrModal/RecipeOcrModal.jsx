import React, { useState } from 'react'
import { Camera, Upload, Check, X, Sparkles, FileText } from 'lucide-react'
import { simulateOcrPrescriptionExtraction } from '../../services/ocrService'
import './RecipeOcrModal.css'

export default function RecipeOcrModal({ onClose, onConfirmStudies }) {
  const [file, setFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [selectedStudyNames, setSelectedStudyNames] = useState([])

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setImagePreview(URL.createObjectURL(selected))
    }
  }

  const handleSimulateSampleImage = () => {
    // Foto médica simulada
    setFile({ name: 'receta_prescripcion_medica.jpg' })
    setImagePreview('https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=60')
  }

  const handleProcessOcr = async () => {
    setAnalyzing(true)
    try {
      const res = await simulateOcrPrescriptionExtraction(file)
      setOcrResult(res)
      // Por defecto tilda los estudios sugeridos por la IA
      const names = res.suggestedStudies.map((s) => s.categoria)
      setSelectedStudyNames(Array.from(new Set(names)))
    } catch (err) {
      console.error(err)
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleStudy = (studyCategory) => {
    setSelectedStudyNames((prev) =>
      prev.includes(studyCategory) ? prev.filter((c) => c !== studyCategory) : [...prev, studyCategory]
    )
  }

  const handleConfirm = () => {
    onConfirmStudies(selectedStudyNames)
    onClose()
  }

  return (
    <div className="ocr-modal">
      <div className="ocr-modal__card">
        <button className="ocr-modal__close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="ocr-modal__header">
          <div className="ocr-modal__chip-ai">
            <Sparkles size={16} />
            <span>IA On-Premise (PaddleOCR / TrOCR)</span>
          </div>
          <h3 className="ocr-modal__title">Escaneo y Reconocimiento de Receta Médica</h3>
          <p className="ocr-modal__subtitle">
            Procesamiento seguro en memoria volátil de la red institucional sin salida a la nube (Cumplimiento PHI).
          </p>
        </div>

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
                  <button type="button" className="ocr-modal__sample-btn" onClick={handleSimulateSampleImage}>
                    Usar receta de prueba
                  </button>
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
                    Segmentando texto manuscrito con IA...
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
                <p>La IA detectó las siguientes prácticas. Modifique o confirme los estudios antes de emitir el ticket:</p>
              </div>
            </div>

            <div className="ocr-modal__raw-preview">
              <FileText size={15} />
              <span>Texto extraído: "{ocrResult.extractedRawText}"</span>
            </div>

            <div className="ocr-modal__studies-grid">
              {['Hemograma', 'Bioquimica', 'Orina', 'Cultivo', 'Otro'].map((cat) => {
                const isSelected = selectedStudyNames.includes(cat)
                return (
                  <label
                    key={cat}
                    className={`ocr-modal__study-item ${isSelected ? 'ocr-modal__study-item--selected' : ''}`}
                    onClick={() => toggleStudy(cat)}
                  >
                    <input type="checkbox" className="ocr-modal__study-checkbox" checked={isSelected} readOnly />
                    <span className="ocr-modal__study-name">{cat}</span>
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
