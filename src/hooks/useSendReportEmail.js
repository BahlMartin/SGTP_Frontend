import { useState, useCallback } from 'react'
import { sendDailyReportEmailApi } from '../services/reportService'

/**
 * Hook reutilizable para el despacho y notificación del reporte diario o por período por correo electrónico.
 * Soporta envío al propio usuario autenticado o al correo manual de un tercero.
 */
export function useSendReportEmail({
  jornadaDate,
  jornadaEndDate = null,
  recipientEmail,
  onSuccessNotice,
  onErrorNotice
}) {
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState(null)

  const clearEmailError = useCallback(() => {
    setEmailError(null)
  }, [])

  const handleSendEmail = useCallback(
    async (customRecipientEmail = null) => {
      if (isSendingEmail) return { success: false }

      setEmailError(null)
      try {
        setIsSendingEmail(true)
        const targetEmailAddress =
          typeof customRecipientEmail === 'string'
            ? customRecipientEmail.trim()
            : recipientEmail || undefined

        const responsePayload = await sendDailyReportEmailApi(
          jornadaDate,
          targetEmailAddress,
          jornadaEndDate || jornadaDate
        )

        if (onSuccessNotice) {
          onSuccessNotice(responsePayload.message)
        }
        return {
          success: true,
          message: responsePayload.message
        }
      } catch (errorInstance) {
        const errorMessage =
          errorInstance?.data?.detail ||
          errorInstance?.data?.detalle ||
          errorInstance?.message ||
          'Error al enviar el reporte diario por correo.'
        setEmailError(errorMessage)
        if (onErrorNotice) {
          onErrorNotice(errorMessage)
        }
        return {
          success: false,
          error: errorMessage
        }
      } finally {
        setIsSendingEmail(false)
      }
    },
    [isSendingEmail, jornadaDate, jornadaEndDate, recipientEmail, onSuccessNotice, onErrorNotice]
  )

  return {
    handleSendEmail,
    isSendingEmail,
    emailError,
    clearEmailError
  }
}
