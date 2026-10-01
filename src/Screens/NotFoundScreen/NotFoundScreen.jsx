import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Home } from 'lucide-react'
import './NotFoundScreen.css'

export default function NotFoundScreen() {
  const navigate = useNavigate()

  return (
    <div className="not-found">
      <div className="not-found__card">
        <AlertTriangle size={54} className="not-found__icon" />
        <h1 className="not-found__title">404 - Pantalla No Encontrada</h1>
        <p className="not-found__desc">El recurso sanitario solicitado no existe o fue reubicado.</p>
        <button className="not-found__btn" onClick={() => navigate('/')}>
          <Home size={18} />
          Volver al Inicio
        </button>
      </div>
    </div>
  )
}
