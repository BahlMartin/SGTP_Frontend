const LOCAL_USERS_KEY = 'sgtp_users_db'

function getUsersFromStorage() {
  const stored = localStorage.getItem(LOCAL_USERS_KEY)
  if (!stored) return []
  return JSON.parse(stored)
}

function saveUsersToStorage(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

export async function fetchAllStaffApi() {
  const users = getUsersFromStorage()
  return users.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    matricula: u.matricula,
    rol: u.rol,
    turno: u.turno || 'Sin asignar',
    estado: u.dentro_horario ? 'En turno' : 'Fuera de turno',
    activo: u.activo,
    cant_intentos: u.cant_intentos,
    pacientesAtendidos: u.rol === 'Box' ? 3 : 0,
    area: u.rol === 'Box' ? 'Área general' : 'Administración'
  }))
}

export async function createStaffUserApi(currentUserRole, newUserPayload) {
  // Validación estricta de jerarquía RBAC
  if (currentUserRole === 'Jefa') {
    if (newUserPayload.rol === 'Admin' || newUserPayload.rol === 'Jefa') {
      throw new Error('Restricción de jerarquía: El rol de Jefa tiene prohibido crear usuarios con rol Admin o Jefa.')
    }
  } else if (currentUserRole !== 'Admin') {
    throw new Error('Permisos insuficientes para crear personal.')
  }

  const users = getUsersFromStorage()
  const exists = users.find((u) => u.email.toLowerCase() === newUserPayload.email.toLowerCase())
  if (exists) throw new Error('Ya existe un usuario con este correo electrónico.')

  const newId = Math.max(...users.map((u) => u.id), 0) + 1
  const created = {
    id: newId,
    email: newUserPayload.email,
    password: newUserPayload.password || 'password123',
    nombre: newUserPayload.nombre,
    matricula: newUserPayload.matricula,
    rol: newUserPayload.rol,
    activo: true,
    cant_intentos: 0,
    turno: newUserPayload.turno || 'Mañana (07:00 - 15:00)',
    dentro_horario: true
  }

  users.push(created)
  saveUsersToStorage(users)
  return created
}

export async function toggleShiftExceptionApi(userId, habilitado) {
  const users = getUsersFromStorage()
  const user = users.find((u) => u.id === Number(userId))
  if (!user) throw new Error('Usuario no encontrado.')

  user.dentro_horario = habilitado
  saveUsersToStorage(users)
  return user
}

export async function deleteStaffUserApi(currentUserRole, userId) {
  const users = getUsersFromStorage()
  const user = users.find((u) => u.id === Number(userId))

  if (!user) throw new Error('Usuario no encontrado.')

  if (currentUserRole === 'Jefa') {
    if (user.rol === 'Admin' || user.rol === 'Jefa') {
      throw new Error('La Jefa no puede eliminar usuarios con rol administrativo.')
    }
  } else if (currentUserRole !== 'Admin') {
    throw new Error('Permisos insuficientes para eliminar personal.')
  }

  const filteredUsers = users.filter((u) => u.id !== Number(userId))
  saveUsersToStorage(filteredUsers)
  return { deletedId: Number(userId), deletedUser: user }
}
