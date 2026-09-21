// Servicio de autenticación con RBAC, políticas de intentos y control de turnos
import { getDemoCredentials as getRuntimeDemoCredentials, getRuntimeUsers, saveRuntimeUsers } from './runtimeUserStore'

export async function loginApi(email, password) {
  // Simulación de latencia de red segura
  await new Promise((resolve) => setTimeout(resolve, 300))

  const users = getRuntimeUsers()
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())

  if (!user) {
    throw new Error('Credenciales inválidas. Verifique su usuario o contraseña.')
  }

  // Verificar si la cuenta se encuentra bloqueada por superar 3 intentos
  if (user.cant_intentos >= 3) {
    throw new Error(
      'Cuenta bloqueada por seguridad tras 3 intentos fallidos consecutivos. Contacte a la Jefa, Admin o Secretaría para su desbloqueo.'
    )
  }

  if (user.password !== password) {
    user.cant_intentos = (user.cant_intentos || 0) + 1
    saveRuntimeUsers(users)

    const remaining = 3 - user.cant_intentos
    if (remaining <= 0) {
      throw new Error('Cuenta bloqueada: Ha superado el límite de 3 intentos fallidos de autenticación.')
    } else {
      throw new Error(`Contraseña incorrecta. Le quedan ${remaining} intento(s) antes del bloqueo.`)
    }
  }

  // Reset de intentos al autenticar exitosamente
  user.cant_intentos = 0
  saveRuntimeUsers(users)

  // Token simulado con estructura JWT estándar
  const fakeToken = btoa(
    JSON.stringify({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      matricula: user.matricula,
      rol: user.rol,
      boxAsignado: user.boxAsignado,
      turno: user.turno,
      dentro_horario: user.dentro_horario,
      exp: Math.floor(Date.now() / 1000) + 3600 * 8
    })
  )

  return {
    token: fakeToken,
    user: { ...user }
  }
}

export async function unlockUserApi(userId) {
  const users = getRuntimeUsers()
  const target = users.find((u) => u.id === Number(userId))
  if (target) {
    target.cant_intentos = 0
    saveRuntimeUsers(users)
    return { ok: true, message: `Usuario ${target.nombre} desbloqueado exitosamente.` }
  }
  throw new Error('Usuario no encontrado.')
}

export function getDemoCredentials() {
  return getRuntimeDemoCredentials()
}
