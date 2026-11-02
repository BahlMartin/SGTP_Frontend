import React, { useState, useEffect } from 'react'
import { Clock, Save, Check, AlertCircle, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react'
import { fetchSlaConfigsApi, updateSlaConfigApi } from '../../../../services/slaService'
import './SlaConfigCard.css'

const TRIAGE_VISUALS = {
  guardia: {
    color: '#e11d48',
    bg: '#ffe4e6',
    border: '#fecdd3',
    textColor: '#9f1239',
    tag: 'Urgencia Inmediata'
  },
  medicos: {
    color: '#0284c7',
    bg: '#e0f2fe',
    border: '#bae6fd',
    textColor: '#0369a1',
    tag: 'Personal Sanitario'
  },
  discapacidad: {
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fde68a',
    textColor: '#92400e',
    tag: 'Prioridad Asistencial'
  },
  oncologia: {
    color: '#7c3aed',
    bg: '#f3e8ff',
    border: '#e9d5ff',
    textColor: '#6b21a8',
    tag: 'Protocolo Oncológico'
  },
  'extraccion con turno': {
    color: '#2563eb',
    bg: '#dbeafe',
    border: '#bfdbfe',
    textColor: '#1e40af',
    tag: 'Turno Programado'
  },
  'extraccion sin turno': {
    color: '#059669',
    bg: '#dcfce7',
    border: '#bbf7d0',
    textColor: '#15803d',
    tag: 'Demanda Espontánea'
  },
  otro: {
    color: '#64748b',
    bg: '#f1f5f9',
    border: '#e2e8f0',
    textColor: '#334155',
    tag: 'Atención Especial'
  }
}

export default function SlaConfigCard({ onNotice = () => {} }) {
  const [configs, setConfigs] = useState([])
  const [draftValues, setDraftValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [justSavedId, setJustSavedId] = useState(null)

  const loadConfigs = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await fetchSlaConfigsApi()
      setConfigs(data)
      const initialDrafts = {}
      data.forEach((item) => {
        initialDrafts[item.id] = item.tiempo_objetivo_minutos
      })
      setDraftValues(initialDrafts)
    } catch (err) {
      console.error('Error al cargar configuración de SLA:', err)
      setErrorMsg(err.message || 'No se pudo cargar la configuración de tiempos de espera.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const handleInputChange = (id, value) => {
    setDraftValues((prev) => ({
      ...prev,
      [id]: value
    }))
  }

  const handleSaveRow = async (item) => {
    const rawVal = draftValues[item.id]
    const numericVal = parseInt(rawVal, 10)

    if (isNaN(numericVal) || numericVal < 1 || numericVal > 480) {
      alert('Por favor ingrese un tiempo objetivo válido entre 1 y 480 minutos (máx. 8 horas).')
      return
    }

    setSavingId(item.id)
    setErrorMsg('')
    try {
      const updated = await updateSlaConfigApi(item.id, {
        tiempo_objetivo_minutos: numericVal
      })

      setConfigs((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, tiempo_objetivo_minutos: updated.tiempo_objetivo_minutos } : c))
      )
      setDraftValues((prev) => ({
        ...prev,
        [item.id]: updated.tiempo_objetivo_minutos
      }))

      setJustSavedId(item.id)
      setTimeout(() => {
        setJustSavedId(null)
      }, 2500)

      onNotice(`Tiempo objetivo de "${item.nombre_display}" actualizado a ${numericVal} minutos.`)
    } catch (err) {
      console.error('Error al guardar SLA:', err)
      setErrorMsg(err.message || `No se pudo actualizar el tiempo objetivo de "${item.nombre_display}".`)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="jefa-screen__sla-card">
      <div className="jefa-screen__sla-header">
        <div className="jefa-screen__sla-title-wrap">
          <Clock className="jefa-screen__sla-icon" />
          <div>
            <h3 className="jefa-screen__sla-title">Tiempos Objetivos de Espera (SLA de Triage)</h3>
            <p className="jefa-screen__sla-subtitle">
              Calibración de tiempos máximos deseables de atención en sala para reportes operativos, gerenciales y auditoría
            </p>
          </div>
        </div>

        <div className="jefa-screen__sla-stats">
          <button
            type="button"
            className="jefa-screen__sla-refresh-btn"
            onClick={loadConfigs}
            disabled={loading}
            title="Recargar configuración"
          >
            <RefreshCw size={13} className={loading ? 'jefa-screen__sla-spin' : ''} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="jefa-screen__sla-alert" role="alert">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="jefa-screen__sla-loading">
          <span className="jefa-screen__mini-spinner" />
          <span>Cargando configuración de tiempos...</span>
        </div>
      ) : (
        <div className="jefa-screen__sla-table-wrap">
          <table className="jefa-screen__sla-table">
            <thead>
              <tr>
                <th className="jefa-screen__sla-th">Categoría de Triage</th>
                <th className="jefa-screen__sla-th">Prioridad Asistencial</th>
                <th className="jefa-screen__sla-th jefa-screen__sla-th--center">Tiempo Objetivo (min)</th>
                <th className="jefa-screen__sla-th jefa-screen__sla-th--center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((item) => {
                const visual = TRIAGE_VISUALS[item.clasificacion_triage] || TRIAGE_VISUALS.otro
                const currentValue = draftValues[item.id] !== undefined ? draftValues[item.id] : item.tiempo_objetivo_minutos
                const isModified = String(currentValue) !== String(item.tiempo_objetivo_minutos)
                const isSavingThis = savingId === item.id
                const isJustSaved = justSavedId === item.id

                return (
                  <tr key={item.id} className="jefa-screen__sla-tr">
                    <td className="jefa-screen__sla-td">
                      <div className="jefa-screen__sla-category-cell">
                        <span
                          className="jefa-screen__sla-dot"
                          style={{ backgroundColor: visual.color }}
                          aria-hidden="true"
                        />
                        <div className="jefa-screen__sla-cat-info">
                          <strong className="jefa-screen__sla-cat-title">{item.nombre_display}</strong>
                          <span className="jefa-screen__sla-cat-key">{item.clasificacion_triage}</span>
                        </div>
                      </div>
                    </td>

                    <td className="jefa-screen__sla-td">
                      <div className="jefa-screen__sla-priority-box">
                        <span
                          className="jefa-screen__sla-priority-pill"
                          style={{
                            backgroundColor: visual.bg,
                            borderColor: visual.border,
                            color: visual.textColor
                          }}
                        >
                          {visual.tag}
                        </span>
                        <span className="jefa-screen__sla-priority-desc">
                          {item.descripcion_prioridad || 'Protocolo asistencial estándar'}
                        </span>
                      </div>
                    </td>

                    <td className="jefa-screen__sla-td jefa-screen__sla-td--center">
                      <div className="jefa-screen__sla-input-wrap">
                        <input
                          type="number"
                          min="1"
                          max="480"
                          step="1"
                          className={`jefa-screen__sla-input ${isModified ? 'jefa-screen__sla-input--dirty' : ''}`}
                          value={currentValue}
                          onChange={(e) => handleInputChange(item.id, e.target.value)}
                          disabled={isSavingThis}
                          aria-label={`Tiempo objetivo para ${item.nombre_display} en minutos`}
                        />
                        <span className="jefa-screen__sla-unit">min</span>
                      </div>
                    </td>

                    <td className="jefa-screen__sla-td jefa-screen__sla-td--center">
                      <button
                        type="button"
                        className={`jefa-screen__sla-btn-save ${
                          isJustSaved
                            ? 'jefa-screen__sla-btn-save--saved'
                            : isModified
                              ? 'jefa-screen__sla-btn-save--dirty'
                              : 'jefa-screen__sla-btn-save--disabled'
                        }`}
                        onClick={() => handleSaveRow(item)}
                        disabled={!isModified || isSavingThis}
                        title={
                          isJustSaved
                            ? '¡Guardado correctamente!'
                            : isModified
                              ? `Guardar tiempo de ${item.nombre_display}`
                              : 'Sin cambios pendientes'
                        }
                      >
                        {isSavingThis ? (
                          <>
                            <span className="jefa-screen__sla-mini-spinner" />
                            <span>Guardando...</span>
                          </>
                        ) : isJustSaved ? (
                          <>
                            <Check size={13} />
                            <span>Guardado</span>
                          </>
                        ) : (
                          <>
                            <Save size={13} />
                            <span>Guardar</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="jefa-screen__sla-footer-note">
            <AlertCircle size={14} className="jefa-screen__sla-note-icon" />
            <span>
              Los tiempos objetivo aquí configurados son utilizados en tiempo real por el motor de reportes
              (PDF, Excel y correos gerenciales) para auditar el cumplimiento del SLA y clasificar las esperas en
              <strong> Cumple</strong> o <strong>Excedido</strong>.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

