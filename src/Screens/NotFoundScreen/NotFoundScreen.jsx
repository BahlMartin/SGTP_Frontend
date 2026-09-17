import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Home } from 'lucide-react'
import './NotFoundScreen.css'

export default function NotFoundScreen() {
  const navigate = useNavigate()

  return (
    <div className="not-found-container">
      <div className="not-found-card">
        <AlertTriangle size={54} className="not-found-icon" />
        <h1>404 - Pantalla No Encontrada</h1>
        <p>El recurso sanitario solicitado no existe o fue reubicado.</p>
        <button className="btn-go-home" onClick={() => navigate('/')}>
          <Home size={18} />
          Volver al Inicio
        </button>
      </div>
    </div>
  )
}
