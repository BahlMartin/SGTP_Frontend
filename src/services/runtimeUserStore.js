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

let runtimeUsers = DEMO_USERS.map((user) => ({ ...user }))

export function getRuntimeUsers() {
  return runtimeUsers
}

export function saveRuntimeUsers(users) {
  runtimeUsers = users
}

export function getDemoCredentials() {
  return DEMO_USERS
}
