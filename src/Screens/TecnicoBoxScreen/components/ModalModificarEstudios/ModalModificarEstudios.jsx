import React, { useState, useEffect } from 'react'
import { X, AlertCircle, Plus, Trash2, RotateCcw, CheckCircle2, Stethoscope } from 'lucide-react'
import StudiesSelector from '../../../../components/StudiesSelector/StudiesSelector'
import './ModalModificarEstudios.css'

export default function ModalModificarEstudios({
  isOpen = false,
  onClose = () => {},
  patientInBox = null,
  onSave = async () => {},
  isProcessing = false
}) {
  const [estudiosParaCancelar, setEstudiosParaCancelar] = useState({})
  const [nuevosEstudios, setNuevosEstudios] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  // Reiniciar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setEstudiosParaCancelar({})
      setNuevosEstudios([])
      setErrorMessage('')
    }
  }, [isOpen, patientInBox])

  if (!isOpen || !patientInBox) return null

  // Obtener lista estructurada de estudios existentes
  const rawEstudios = patientInBox.estudios_raw || []
  const estudiosExistentes = rawEstudios.length > 0
    ? rawEstudios
    : (patientInBox.estudios || []).map((name, index) => ({
        id: index + 1,
        estudio: index + 1,
        estudio_detalle: { id: index + 1, nombre: name },
        estado: 'Solicitado',
        origen: 'admision'
      }))

  const handleToggleCancelar = (estudioId) => {
    setErrorMessage('')
    setEstudiosParaCancelar((prev) => {
      const copy = { ...prev }
      if (copy[estudioId] !== undefined) {
        delete copy[estudioId]
      } else {
        copy[estudioId] = 'No solicitado en orden médica física'
      }
      return copy
    })
  }

  const handleMotivoChange = (estudioId, motivoTexto) => {
    setEstudiosParaCancelar((prev) => ({
      ...prev,
      [estudioId]: motivoTexto
    }))
  }

  const handleSelectNewStudy = (studyObj) => {
    setErrorMessage('')
    if (!studyObj?.id) return

    // Evitar duplicar en los nuevos a agregar
    if (nuevosEstudios.some((s) => s.id === studyObj.id)) {
      return
    }

    // Si ya existe activo en la orden original y no está marcado para cancelar
    const yaExisteEnOrden = estudiosExistentes.some(
      (e) => (e.estudio === studyObj.id || e.estudio_detalle?.id === studyObj.id) &&
             e.estado !== 'Cancelado' &&
             estudiosParaCancelar[e.estudio || e.estudio_detalle?.id] === undefined
    )

    if (yaExisteEnOrden) {
      setErrorMessage(`El estudio "${studyObj.nombre}" ya se encuentra activo en esta orden.`)
      return
    }

    setNuevosEstudios((prev) => [
      ...prev,
      {
        id: studyObj.id,
        nombre: studyObj.nombre,
        codigo_practica: studyObj.codigo_practica,
        motivo: 'Solicitado en orden médica física'
      }
    ])
  }

  const handleRemoveNewStudy = (studyId) => {
    setNuevosEstudios((prev) => prev.filter((s) => s.id !== studyId))
  }

  const handleSave = async () => {
    const canceladosKeys = Object.keys(estudiosParaCancelar)
    if (canceladosKeys.length === 0 && nuevosEstudios.length === 0) {
      onClose()
      return
    }

    // Validar regla de integridad: al menos 1 estudio activo
    const estudiosActivosOriginales = estudiosExistentes.filter((e) => e.estado !== 'Cancelado')
    const activosQuePermanecen = estudiosActivosOriginales.filter(
      (e) => estudiosParaCancelar[e.estudio || e.estudio_detalle?.id] === undefined
    )

    if (activosQuePermanecen.length === 0 && nuevosEstudios.length === 0) {
      setErrorMessage(
        'El paciente debe conservar al menos un estudio activo. No es posible cancelar la totalidad de los estudios.'
      )
      return
    }

    const payloadCancelar = canceladosKeys.map((estudioId) => ({
      estudio_id: Number(estudioId),
      motivo: estudiosParaCancelar[estudioId] || 'Cancelado en box por indicación u orden médica'
    }))

    const payloadAgregar = nuevosEstudios.map((study) => ({
      estudio_id: study.id,
      motivo: study.motivo || 'Agregado en box por indicación médica'
    }))

    try {
      await onSave({
        cancelarEstudios: payloadCancelar,
        agregarEstudios: payloadAgregar
      })
      onClose()
    } catch (error) {
      setErrorMessage(error.message || 'Error al actualizar los estudios del box.')
    }
  }

  return (
    <div className="modal-modificar-estudios__backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-modificar-estudios__card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-modificar-estudios__header">
          <div className="modal-modificar-estudios__title-box">
            <Stethoscope className="modal-modificar-estudios__icon" />
            <div>
              <h3 className="modal-modificar-estudios__title">Ajustar Estudios Médicos en Box</h3>
              <p className="modal-modificar-estudios__subtitle">
                Paciente: {patientInBox.paciente_nombre} {patientInBox.paciente_apellido} (Ticket {patientInBox.num_totem})
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-modificar-estudios__close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal-modificar-estudios__body">
          {errorMessage && (
            <div className="modal-modificar-estudios__item--cancelled" style={{ padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="#b91c1c" />
              <span style={{ fontSize: '0.84rem', color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</span>
            </div>
          )}

          {/* Sección 1: Estudios actuales de la orden */}
          <div className="modal-modificar-estudios__section">
            <span className="modal-modificar-estudios__section-title">
              Estudios ingresados en la orden médica:
            </span>
            <div className="modal-modificar-estudios__studies-list">
              {estudiosExistentes.map((item) => {
                const estudioId = item.estudio || item.estudio_detalle?.id || item.id
                const nombreEstudio = item.estudio_detalle?.nombre || item.nombre || 'Estudio Médico'
                const isAlreadyCancelled = item.estado === 'Cancelado'
                const isMarkedForCancel = estudiosParaCancelar[estudioId] !== undefined

                if (isAlreadyCancelled) {
                  return (
                    <div key={estudioId} className="modal-modificar-estudios__item modal-modificar-estudios__item--cancelled">
                      <div className="modal-modificar-estudios__item-row">
                        <div className="modal-modificar-estudios__item-info">
                          <span className="modal-modificar-estudios__item-name modal-modificar-estudios__item-name--strike">
                            {nombreEstudio}
                          </span>
                          <span className="modal-modificar-estudios__badge-tag modal-modificar-estudios__badge-tag--cancelled">
                            Ya Cancelado
                          </span>
                        </div>
                      </div>
                      {item.motivo_modificacion && (
                        <span style={{ fontSize: '0.78rem', color: '#991b1b' }}>
                          Motivo: {item.motivo_modificacion}
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={estudioId}
                    className={`modal-modificar-estudios__item ${
                      isMarkedForCancel ? 'modal-modificar-estudios__item--cancelled' : ''
                    }`}
                  >
                    <div className="modal-modificar-estudios__item-row">
                      <div className="modal-modificar-estudios__item-info">
                        <span
                          className={`modal-modificar-estudios__item-name ${
                            isMarkedForCancel ? 'modal-modificar-estudios__item-name--strike' : ''
                          }`}
                        >
                          {nombreEstudio}
                        </span>
                        {item.origen === 'box' && (
                          <span className="modal-modificar-estudios__badge-tag modal-modificar-estudios__badge-tag--box">
                            Box
                          </span>
                        )}
                        {isMarkedForCancel && (
                          <span className="modal-modificar-estudios__badge-tag modal-modificar-estudios__badge-tag--cancelled">
                            A Cancelar
                          </span>
                        )}
                      </div>

                      {isMarkedForCancel ? (
                        <button
                          type="button"
                          className="modal-modificar-estudios__btn-undo"
                          onClick={() => handleToggleCancelar(estudioId)}
                        >
                          <RotateCcw size={14} /> Deshacer
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="modal-modificar-estudios__btn-cancel"
                          onClick={() => handleToggleCancelar(estudioId)}
                        >
                          <Trash2 size={14} /> Cancelar estudio
                        </button>
                      )}
                    </div>

                    {isMarkedForCancel && (
                      <div className="modal-modificar-estudios__reason-box">
                        <label className="modal-modificar-estudios__reason-label">
                          Motivo clínico de cancelación (requerido para auditoría):
                        </label>
                        <input
                          type="text"
                          className="modal-modificar-estudios__reason-input"
                          placeholder="Ej: No solicitado en orden médica física / Muestra no indicada"
                          value={estudiosParaCancelar[estudioId]}
                          onChange={(e) => handleMotivoChange(estudioId, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sección 2: Agregar nuevo estudio */}
          <div className="modal-modificar-estudios__section">
            <span className="modal-modificar-estudios__section-title">
              <Plus size={16} /> Agregar nuevo estudio a la orden (desde catálogo):
            </span>

            <StudiesSelector
              showOcrButton={false}
              showSelectedChips={false}
              label=""
              placeholder="Buscar práctica clínica médica para agregar..."
              onToggleStudy={handleSelectNewStudy}
            />

            {nuevosEstudios.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>
                  Estudios a incorporar en Box ({nuevosEstudios.length}):
                </span>
                {nuevosEstudios.map((study) => (
                  <div key={study.id} className="modal-modificar-estudios__new-item">
                    <span>+ {study.nombre}</span>
                    <button
                      type="button"
                      className="modal-modificar-estudios__new-item-btn-remove"
                      onClick={() => handleRemoveNewStudy(study.id)}
                      title="Quitar de la lista"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="modal-modificar-estudios__footer">
          <button
            type="button"
            className="modal-modificar-estudios__btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="modal-modificar-estudios__btn-primary"
            onClick={handleSave}
            disabled={isProcessing}
          >
            <CheckCircle2 size={16} />
            {isProcessing ? 'Guardando cambios...' : 'Guardar Modificaciones'}
          </button>
        </footer>
      </div>
    </div>
  )
}
