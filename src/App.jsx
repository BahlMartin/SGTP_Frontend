import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthContextProvider } from './context/AuthContext'
import { TriageQueueContextProvider } from './context/TriageQueueContext'
import { BoxContextProvider } from './context/BoxContext'

import AlreadyAuthMiddleware from './middlewares/AlreadyAuthMiddleware'
import AuthMiddleware from './middlewares/AuthMiddleware'
import ShiftTimeMiddleware from './middlewares/ShiftTimeMiddleware'
import RoleMiddleware from './middlewares/RoleMiddleware'

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
                {/* 1. Admisión: Registro de pacientes, triage y emisión de tickets */}
                <Route element={<RoleMiddleware allowedRoles={['Admision', 'Admin']} />}>
                  <Route path="/admision" element={<AdmisionScreen />} />
                </Route>

                {/* 2. Box de Atención: Panel de control de box y cola multibox centralizada */}
                <Route element={<RoleMiddleware allowedRoles={['Box', 'Admin']} />}>
                  <Route path="/box" element={<TecnicoBoxScreen />} />
                  <Route path="/tecnico" element={<Navigate to="/box" replace />} />
                </Route>

                {/* 3. Supervisión: Jefa y Admin */}
                <Route element={<RoleMiddleware allowedRoles={['Jefa', 'Admin']} />}>
                  <Route path="/supervision" element={<JefaScreen />} />
                  <Route path="/jefa" element={<Navigate to="/supervision" replace />} />
                </Route>

                {/* 4. Reportes: Secretaría, Jefa y Admin */}
                <Route element={<RoleMiddleware allowedRoles={['Secretaria', 'Jefa', 'Admin']} />}>
                  <Route path="/reportes" element={<SecretariaScreen />} />
                  <Route path="/secretaria" element={<Navigate to="/reportes" replace />} />
                </Route>
              </Route>
            </Route>

            {/* Ruta Fallback 404 */}
            <Route path="/404" element={<NotFoundScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </TriageQueueContextProvider>
      </BoxContextProvider>
    </AuthContextProvider>
  )
}
