import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthContextProvider } from './context/AuthContext'
import { TriageQueueContextProvider } from './context/TriageQueueContext'
import { BoxContextProvider } from './context/BoxContext'

import AlreadyAuthMiddleware from './middlewares/AlreadyAuthMiddleware'
import AuthMiddleware from './middlewares/AuthMiddleware'
import ShiftTimeMiddleware from './middlewares/ShiftTimeMiddleware'

import LoginScreen from './Screens/LoginScreen/LoginScreen'
import AdmisionScreen from './Screens/AdmisionScreen/AdmisionScreen'
import TecnicoBoxScreen from './Screens/TecnicoBoxScreen/TecnicoBoxScreen'
import JefaScreen from './Screens/JefaScreen/JefaScreen'
import SecretariaScreen from './Screens/SecretariaScreen/SecretariaScreen'
import NotFoundScreen from './Screens/NotFoundScreen/NotFoundScreen'

export default function App() {
  return (
    <AuthContextProvider>
      <BoxContextProvider>
        <TriageQueueContextProvider>
          <Routes>
            {/* Rutas no autenticadas (Redirige al dashboard si ya está autenticado) */}
            <Route element={<AlreadyAuthMiddleware />}>
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Route>

            {/* Rutas autenticadas y protegidas por RBAC y Horario Laboral */}
            <Route element={<AuthMiddleware />}>
              <Route element={<ShiftTimeMiddleware />}>
                {/* 1. Admisión: Registro de pacientes, triage y emisión de tickets (Imagen 3) */}
                <Route path="/admision" element={<AdmisionScreen />} />

                {/* 2. Box de Atención: Panel de control de box y cola multibox centralizada (Imagen 4) */}
                <Route path="/box" element={<TecnicoBoxScreen />} />
                <Route path="/tecnico" element={<Navigate to="/box" replace />} />

                {/* 3. Supervisión: Métricas en tiempo real, auditoría y reportes diarios (Imagen 2) */}
                <Route path="/supervision" element={<JefaScreen />} />
                <Route path="/jefa" element={<Navigate to="/supervision" replace />} />

                {/* 4. Reportes: Consulta y descarga de reportes diarios (Imagen 1) */}
                <Route path="/reportes" element={<SecretariaScreen />} />
                <Route path="/secretaria" element={<Navigate to="/reportes" replace />} />
              </Route>
            </Route>

            {/* Ruta Fallback 404 */}
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </TriageQueueContextProvider>
      </BoxContextProvider>
    </AuthContextProvider>
  )
}
