import React, { useState, useEffect } from 'react'
import { Database } from 'lucide-react'
import { fetchAlmacenamientoDbApi } from '../../../services/auditService'
import './DbUsageIndicator.css'

export default function DbUsageIndicator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStorage() {
      try {
        const res = await fetchAlmacenamientoDbApi()
        setData(res)
      } catch (err) {
        console.warn('No se pudo obtener el uso de almacenamiento:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStorage()
  }, [])

  if (loading || !data || data.tamano_mb === null) return null

  const pct = Math.min(100, Math.max(0, data.porcentaje_uso || 0))
  let colorClass = 'db-usage--ok'
  if (pct >= 90) colorClass = 'db-usage--danger'
  else if (pct >= 70) colorClass = 'db-usage--warn'

  return (
    <div
      className={`db-usage-indicator ${colorClass}`}
      title={`Base de Datos Supabase: ${data.tamano_mb} MB de ${data.limite_mb} MB (${pct}%). Purga automática programada a ${data.purga_dias || 365} días.`}
    >
      <div className="db-usage__header">
        <Database size={13} className="db-usage__icon" />
        <span className="db-usage__text">
          BD: <strong>{data.tamano_mb} MB</strong> / {data.limite_mb} MB ({pct}%)
        </span>
      </div>

      <div className="db-usage__bar-bg">
        <div
          className="db-usage__bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

