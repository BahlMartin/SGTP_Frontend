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
   * Obtiene la lista de turnos actualmente en atención en recepción para el día de hoy.
   */
  async getTurnosEnAtencion() {
    return apiClient.get('/turnos-recepcion/en-atencion/')
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
  },

  /**
   * Reserva temporalmente un número de llamado manual en mostrador para sincronizarlo con el Tótem.
   * @param {{ prefijo: string, numero: string|number, reservationToken: string }} data
   */
  async reservarNumeroManual({ prefijo, numero, reservationToken }) {
    return reservarNumeroManualApi({ prefijo, numero, reservationToken })
  },

  /**
   * Libera una reserva manual activa asociada al reservationToken.
   * @param {string} reservationToken
   */
  async liberarReservaManual(reservationToken) {
    return liberarReservaManualApi(reservationToken)
  }
}

export async function reservarNumeroManualApi({ prefijo, numero, reservationToken }) {
  return apiClient.post('/turnos-recepcion/reservar-manual/', {
    prefijo: String(prefijo || '').trim(),
    numero: Number(String(numero ?? '').replace(/\D/g, '')),
    reservation_token: String(reservationToken || '').trim()
  })
}

export async function liberarReservaManualApi(reservationToken) {
  const token = String(reservationToken || '').trim()
  if (!token) return { released: false }
  return apiClient.post('/turnos-recepcion/liberar-reserva-manual/', {
    reservation_token: token
  })
}

export default receptionService
