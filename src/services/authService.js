import apiClient from './apiClient'

/**
 * Servicio de autenticación asistencial contra SGTP Backend.
 * Gestiona inicio de sesión, cierre de sesión y desbloqueo administrativo de cuentas.
 */

export async function loginApi(email, password) {
  const sanitizedEmail = String(email || '').trim().toLowerCase()
  const payload = {
    email: sanitizedEmail,
    password: String(password || '')
  }

  const response = await apiClient.post('/auth/login/', payload)

  // El backend retorna: { mensaje: "...", usuario: { id_personal, email, matricula, nombre, apellidos, rol, inicio_turno, fin_turno } }
  const usuario = response.usuario || {}
  const normalizedUser = {
    id: usuario.id_personal,
    id_personal: usuario.id_personal,
    email: usuario.email || sanitizedEmail,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    matricula: usuario.matricula,
    rol: usuario.rol,
    inicio_turno: usuario.inicio_turno,
    fin_turno: usuario.fin_turno,
    dentro_horario: true // Validado dinámicamente por el middleware del backend
  }

  return {
    user: normalizedUser,
    mensaje: response.mensaje
  }
}

export async function logoutApi() {
  try {
    return await apiClient.post('/auth/logout/')
  } catch (error) {
    console.warn('Advertencia al cerrar sesión en el servidor:', error)
    return { mensaje: 'Sesión finalizada localmente.' }
  }
}

export async function unlockUserApi(idPersonal) {
  const payload = {
    id_personal: Number(idPersonal)
  }
  return await apiClient.post('/auth/desbloquear/', payload)
}
