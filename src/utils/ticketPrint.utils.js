/**
 * Utilidad pura para la impresión térmica (80mm) de comprobantes y tickets asistenciales.
 * Aplica estilos CSS dinámicos @page, aisla el elemento imprimible y limpia el DOM al finalizar.
 *
 * @param {string} elementId Identificador DOM del contenedor a imprimir (por defecto 'printable-ticket')
 */
export function printThermalTicket(elementId = 'printable-ticket') {
  const printableTicket = document.getElementById(elementId)
  if (!printableTicket) {
    throw new Error(`No se encontró el elemento con ID '${elementId}' para imprimir.`)
  }

  const printElements = []
  const hideElements = []
  const printPageStyle = document.createElement('style')

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup)
    document.body.classList.remove('ticket-printing')
    printElements.forEach((element) => element.classList.remove('ticket-print-ancestor'))
    hideElements.forEach((element) => element.classList.remove('ticket-print-hidden'))
    printPageStyle.remove()
  }

  document.body.classList.add('ticket-printing')
  let element = printableTicket

  while (element) {
    element.classList.add('ticket-print-ancestor')
    printElements.push(element)

    const parent = element.parentElement
    if (parent) {
      Array.from(parent.children).forEach((sibling) => {
        if (sibling !== element) {
          sibling.classList.add('ticket-print-hidden')
          hideElements.push(sibling)
        }
      })
    }

    element = parent
  }

  const ticketHeightMm = Math.ceil(
    (printableTicket.getBoundingClientRect().height * 25.4) / 96 + 2
  )
  printPageStyle.textContent = `@page { size: 80mm ${ticketHeightMm}mm; margin: 0; }`
  document.head.appendChild(printPageStyle)

  window.addEventListener('afterprint', cleanup, { once: true })

  try {
    window.print()
  } catch (error) {
    cleanup()
    throw error
  }
}
