/**
 * Mapeo de roles a su ruta de inicio predeterminada en el sistema.
 */
export const ROLE_HOME_PATHS = {
  Admision: '/admision',
  Box: '/box',
  Jefa: '/supervision',
  Admin: '/supervision',
  Secretaria: '/reportes'
}

/**
 * Obtiene la ruta inicial correspondiente a un rol de usuario.
 * @param {string} [role] - Rol del usuario (ej: 'Admision', 'Box', 'Jefa', 'Admin', 'Secretaria')
 * @param {string} [fallback='/404'] - Ruta de respaldo si el rol no es reconocido o es nulo
 * @returns {string} Ruta URL asignada
 */
export const getHomePathByRole = (role, fallback = '/404') => {
  if (!role) return fallback
  return ROLE_HOME_PATHS[role] || fallback
}
