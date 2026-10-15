import React from 'react'
import { CheckCircle } from 'lucide-react'
import './JefaHeader.css'

export default function JefaHeader({ statusMessage }) {
  return (
    <>
      <div className="jefa-screen__header">
        <h1 className="jefa-screen__title">Supervisión</h1>
        <p className="jefa-screen__subtitle">
          Búsqueda de pacientes y gestión del personal asistencial
        </p>
      </div>

      {statusMessage && (
        <div className="jefa-screen__alert">
          <CheckCircle className="jefa-screen__alert-icon" />
          <span>{statusMessage}</span>
        </div>
      )}
    </>
  )
}
