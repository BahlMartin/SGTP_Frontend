import React, { useState } from 'react'
import { Camera, Upload, Check, X, Sparkles, AlertCircle, FileText } from 'lucide-react'
import { MASTER_LAB_STUDIES, simulateOcrPrescriptionExtraction } from '../../services/ocrService'
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
    <div className="ocr-modal-overlay">
      <div className="ocr-modal-card">
        <button className="btn-close-modal" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="ocr-modal-header">
          <div className="ocr-chip-ai">
            <Sparkles size={16} />
            <span>IA On-Premise (PaddleOCR / TrOCR)</span>
          </div>
          <h3>Escaneo y Reconocimiento de Receta Médica</h3>
          <p>
            Procesamiento seguro en memoria volátil de la red institucional sin salida a la nube (Cumplimiento PHI).
          </p>
        </div>

        {!ocrResult ? (
          <div className="ocr-upload-step">
            {imagePreview ? (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Receta médica" className="preview-img" />
                <button className="btn-reupload" onClick={() => setImagePreview(null)}>
                  Cambiar imagen
                </button>
              </div>
            ) : (
              <div className="dropzone">
                <Camera size={44} className="dropzone-icon" />
                <p className="dropzone-text">Arrastre o seleccione una fotografía de la orden médica</p>
                <div className="dropzone-buttons">
                  <label className="btn-browse-file">
                    <Upload size={16} />
                    Subir archivo
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                  <button type="button" className="btn-sample-file" onClick={handleSimulateSampleImage}>
                    Usar receta de prueba
                  </button>
                </div>
              </div>
            )}

            <div className="ocr-actions">
              <button
                className="btn-run-ocr"
                disabled={!imagePreview || analyzing}
                onClick={handleProcessOcr}
              >
                {analyzing ? (
                  <>
                    <span className="spinner-mini" />
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
          <div className="ocr-human-loop-step">
            <div className="human-loop-alert">
              <Check size={18} className="check-icon" />
              <div>
                <strong>Revisión Humana Asistida (Human-in-the-Loop)</strong>
                <p>La IA detectó las siguientes prácticas. Modifique o confirme los estudios antes de emitir el ticket:</p>
              </div>
            </div>

            <div className="raw-text-preview">
              <FileText size={15} />
              <span>Texto extraído: "{ocrResult.extractedRawText}"</span>
            </div>

            <div className="studies-selection-grid">
              {['Hemograma', 'Bioquimica', 'Orina', 'Cultivo', 'Otro'].map((cat) => {
                const isSelected = selectedStudyNames.includes(cat)
                return (
                  <label
                    key={cat}
                    className={`study-checkbox-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleStudy(cat)}
                  >
                    <input type="checkbox" checked={isSelected} readOnly />
                    <span className="study-cat-name">{cat}</span>
                  </label>
                )
              })}
            </div>

            <div className="ocr-actions">
              <button className="btn-confirm-studies" onClick={handleConfirm}>
                Confirmar Estudios ({selectedStudyNames.length})
              </button>
              <button className="btn-cancel-ocr" onClick={() => setOcrResult(null)}>
                Volver a escanear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
