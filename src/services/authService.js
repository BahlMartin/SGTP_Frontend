// Servicio de autenticación con RBAC, políticas de intentos y control de turnos

const DEMO_USERS = [
  {
    id: 1,
    email: 'admin@sgtp.hospital.gob.ar',
    password: 'password123',
    nombre: 'Administrador Central',
    matricula: 'ADM-001',
    rol: 'Admin',
    activo: true,
    cant_intentos: 0,
    turno: 'Total (24hs)',
    dentro_horario: true
  },
  {
    id: 2,
    email: 'jefa@sgtp.hospital.gob.ar',
    password: 'password123',
    nombre: 'Dra. Silvina Morales',
    matricula: 'MED-9941',
    rol: 'Jefa',
    activo: true,
    cant_intentos: 0,
    turno: 'Supervisión Mañana/Tarde',
    dentro_horario: true
  },
  {
    id: 3,
    email: 'admision@sgtp.hospital.gob.ar',
    password: 'password123',
    nombre: 'Carla Benítez',
    matricula: 'ADM-4412',
    rol: 'Admision',
    activo: true,
    cant_intentos: 0,
    turno: 'Mañana (07:00 - 15:00)',
    dentro_horario: true
  },
  {
    id: 4,
    email: 'box@sgtp.hospital.gob.ar',
    password: 'password123',
    nombre: 'Tec. Manuel Montiel',
    matricula: 'TEC-3391',
    rol: 'Box',
    activo: true,
    cant_intentos: 0,
    turno: 'Guardia (08:00 - 16:00)',
    dentro_horario: true,
    boxAsignado: 'Box 1'
  },
  {
    id: 5,
    email: 'secretaria@sgtp.hospital.gob.ar',
    password: 'password123',
    nombre: 'Laura Fernández',
    matricula: 'SEC-1082',
    rol: 'Secretaria',
    activo: true,
    cant_intentos: 0,
    turno: 'Diurno (09:00 - 17:00)',
    dentro_horario: true
  }
]

const LOCAL_USERS_KEY = 'sgtp_users_db'
const FAILED_ATTEMPTS_KEY = 'sgtp_failed_attempts'

function getStoredUsers() {
  const stored = localStorage.getItem(LOCAL_USERS_KEY)
  if (!stored) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(DEMO_USERS))
    return DEMO_USERS
  }
  return JSON.parse(stored)
}

function saveStoredUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

export async function loginApi(email, password) {
  // Simulación de latencia de red segura
  await new Promise((resolve) => setTimeout(resolve, 300))

  const users = getStoredUsers()
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
    saveStoredUsers(users)

    const remaining = 3 - user.cant_intentos
    if (remaining <= 0) {
      throw new Error('Cuenta bloqueada: Ha superado el límite de 3 intentos fallidos de autenticación.')
    } else {
      throw new Error(`Contraseña incorrecta. Le quedan ${remaining} intento(s) antes del bloqueo.`)
    }
  }

  // Reset de intentos al autenticar exitosamente
  user.cant_intentos = 0
  saveStoredUsers(users)

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
  const users = getStoredUsers()
  const target = users.find((u) => u.id === Number(userId))
  if (target) {
    target.cant_intentos = 0
    saveStoredUsers(users)
    return { ok: true, message: `Usuario ${target.nombre} desbloqueado exitosamente.` }
  }
  throw new Error('Usuario no encontrado.')
}

export function getDemoCredentials() {
  return DEMO_USERS
}
