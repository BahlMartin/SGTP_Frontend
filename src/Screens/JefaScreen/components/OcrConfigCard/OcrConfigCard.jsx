import React, { useCallback, useEffect, useState } from 'react'
import { Lock, Unlock, RefreshCw, AlertTriangle, AlertCircle, ThumbsUp, ThumbsDown, ScanText } from 'lucide-react'
import { fetchOcrConfigApi, updateOcrConfigApi } from '../../../../services/ocrService'
import './OcrConfigCard.css'

export default function OcrConfigCard({ onNotice = () => {} }) {
  const [config, setConfig] = useState({
    entrenamientoHabilitado: false,
    totalVotosPositivos: 0,
    totalVotosNegativos: 0,
    fechaActualizacion: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await fetchOcrConfigApi()
      setConfig(data)
    } catch (err) {
      console.error('Error al cargar configuración OCR:', err)
      setErrorMsg(err.message || 'No se pudo cargar la configuración del modo Entrenamiento OCR.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    fetchOcrConfigApi()
      .then((data) => {
        if (mounted) {
          setConfig(data)
          setErrorMsg('')
        }
      })
      .catch((err) => {
        console.error('Error al cargar configuración OCR:', err)
        if (mounted) {
          setErrorMsg(err.message || 'No se pudo cargar la configuración del modo Entrenamiento OCR.')
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleToggleTraining = async () => {
    if (saving || loading) return
    const nextEnabled = !config.entrenamientoHabilitado
    setSaving(true)
    setErrorMsg('')
    try {
      const updated = await updateOcrConfigApi(nextEnabled)
      setConfig(updated)
      onNotice(
        updated.entrenamientoHabilitado
          ? 'Modo Entrenamiento OCR habilitado para Admisión.'
          : 'Modo Entrenamiento OCR bloqueado (modo operativo limpio).'
      )
    } catch (err) {
      console.error('Error al actualizar configuración OCR:', err)
      setErrorMsg(err.message || 'No se pudo actualizar la configuración del modo Entrenamiento OCR.')
    } finally {
      setSaving(false)
    }
  }

  const isEnabled = config.entrenamientoHabilitado

  return (
    <div className="jefa-screen__ocr-card">
      <div className="jefa-screen__ocr-header">
        <div className="jefa-screen__ocr-title-wrap">
          <ScanText className="jefa-screen__ocr-icon" />
          <div>
            <h3 className="jefa-screen__ocr-title">OCR de Recetas y Modo Entrenamiento</h3>
            <p className="jefa-screen__ocr-subtitle">
              Controlá si Admisión puede acceder a la pestaña técnica de Entrenamiento / Por Recortes para calibrar trazos y alias
            </p>
          </div>
        </div>

        <button
          type="button"
          className="jefa-screen__ocr-refresh-btn"
          onClick={loadConfig}
          disabled={loading || saving}
          title="Recargar estado OCR"
        >
          <RefreshCw size={13} className={loading ? 'jefa-screen__ocr-spin' : ''} />
          <span>Recargar</span>
        </button>
      </div>

      {errorMsg && (
        <div className="jefa-screen__ocr-alert" role="alert">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="jefa-screen__ocr-loading">
          <span className="jefa-screen__ocr-spinner" />
          <span>Consultando configuración del módulo OCR...</span>
        </div>
      ) : (
        <>
          <div className={`jefa-screen__ocr-status-box ${isEnabled ? 'jefa-screen__ocr-status-box--enabled' : 'jefa-screen__ocr-status-box--locked'}`}>
            <div className="jefa-screen__ocr-status-info">
              <div className="jefa-screen__ocr-status-badges">
                <span className={`jefa-screen__ocr-pill ${isEnabled ? 'jefa-screen__ocr-pill--enabled' : 'jefa-screen__ocr-pill--locked'}`}>
                  {isEnabled ? <Unlock size={13} /> : <Lock size={13} />}
                  <span>
                    {isEnabled
                      ? 'Habilitado · Modo Entrenamiento y Debug'
                      : 'Bloqueado · Modo Operativo Limpio'}
                  </span>
                </span>
              </div>
              <p className="jefa-screen__ocr-status-desc">
                {isEnabled
                  ? 'Admisión puede ingresar a la pestaña Entrenamiento (Por Recortes) para revisar trazos históricos, votar Bien/Mal y registrar recortes manuales.'
                  : 'Admisión trabaja únicamente en Vista General. La pestaña Entrenamiento permanece bloqueada y no se guardan correcciones ni votos en el modelo.'}
              </p>
            </div>

            <button
              type="button"
              className={`jefa-screen__ocr-toggle-btn ${isEnabled ? 'jefa-screen__ocr-toggle-btn--lock' : 'jefa-screen__ocr-toggle-btn--unlock'}`}
              onClick={handleToggleTraining}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="jefa-screen__ocr-spinner jefa-screen__ocr-spinner--btn" />
                  <span>Guardando...</span>
                </>
              ) : isEnabled ? (
                <>
                  <Lock size={14} />
                  <span>Bloquear Entrenamiento</span>
                </>
              ) : (
                <>
                  <Unlock size={14} />
                  <span>Habilitar Entrenamiento</span>
                </>
              )}
            </button>
          </div>

          <div className="jefa-screen__ocr-metrics">
            <div className="jefa-screen__ocr-metric-chip jefa-screen__ocr-metric-chip--good">
              <ThumbsUp size={14} />
              <span>Votos positivos acumulados: <strong>{config.totalVotosPositivos}</strong></span>
            </div>
            <div className="jefa-screen__ocr-metric-chip jefa-screen__ocr-metric-chip--bad">
              <ThumbsDown size={14} />
              <span>Votos negativos acumulados: <strong>{config.totalVotosNegativos}</strong></span>
            </div>
          </div>

          <div className="jefa-screen__ocr-footer-note">
            <AlertCircle size={14} className="jefa-screen__ocr-note-icon" />
            <span>
              Recomendación: mantené el entrenamiento <strong>bloqueado</strong> durante la atención habitual o presentaciones
              para mostrar únicamente la <strong>Vista General</strong> sin riesgo de entrenar el modelo por error desde selecciones rápidas.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
