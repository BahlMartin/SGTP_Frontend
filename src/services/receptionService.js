import apiClient from './apiClient'

/**
 * Servicio de Turnos de Recepción y Tótem de Autoservicio.
 */
export const receptionService = {
  /**
   * Emite un turno desde la pantalla del Tótem de autoservicio.
   * @param {{ dni: string, prefijo: string }} data
   */
  async emitirTurnoTotem({ dni, prefijo }) {
    return apiClient.post('/turnos-recepcion/totem/', {
      dni: String(dni || '').trim(),
      prefijo: String(prefijo || '').trim()
    })
  },

  /**
   * Obtiene la lista de turnos en espera activa en recepción para el día de hoy.
   */
  async getTurnosPendientes() {
    return apiClient.get('/turnos-recepcion/pendientes/')
  },

  /**
   * Convoca a un paciente desde la cola de recepción a mostrador.
   * @param {string} id UUID del turno
   */
  async llamarTurno(id) {
    return apiClient.post(`/turnos-recepcion/${id}/llamar/`)
  },

  /**
   * Marca un turno de recepción como finalizado cuando el paciente es admitido.
   * @param {string} id UUID del turno
   */
  async finalizarTurno(id) {
    return apiClient.post(`/turnos-recepcion/${id}/finalizar/`)
  },

  /**
   * Cancela un turno de recepción (ej. paciente ausente en sala).
   * @param {string} id UUID del turno
   * @param {string} motivo Motivo de cancelación
   */
  async cancelarTurno(id, motivo = '') {
    return apiClient.post(`/turnos-recepcion/${id}/cancelar/`, {
      motivo: String(motivo || '').trim()
    })
  }
}

export default receptionService
