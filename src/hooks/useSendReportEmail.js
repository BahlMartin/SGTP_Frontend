import { useState, useCallback } from 'react'
import { sendDailyReportEmailApi } from '../services/reportService'

/**
 * Hook reutilizable para el despacho y notificación del reporte diario por correo electrónico.
 * Diseñado para ser consumido tanto en JefaScreen como en SecretariaScreen.
 */
export function useSendReportEmail({
  jornadaDate,
  recipientEmail,
  onSuccessNotice
}) {
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const handleSendEmail = useCallback(async () => {
    if (isSendingEmail) return

    try {
      setIsSendingEmail(true)
      const targetEmailAddress = recipientEmail || 'jefa@sgtp.hospital.gob.ar'
      const responsePayload = await sendDailyReportEmailApi(jornadaDate, targetEmailAddress)

      if (onSuccessNotice) {
        onSuccessNotice(responsePayload.message)
      }
    } catch (errorInstance) {
      alert(errorInstance.message || 'Error al enviar el reporte diario por correo.')
    } finally {
      setIsSendingEmail(false)
    }
  }, [isSendingEmail, jornadaDate, recipientEmail, onSuccessNotice])

  return {
    handleSendEmail,
    isSendingEmail
  }
}
