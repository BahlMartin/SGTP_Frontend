/**
 * Utilidad pura para la impresión térmica (80mm) de comprobantes y tickets asistenciales,
 * y de etiquetas autoadhesivas continuas (50mm, ej. LP4206D) in-page vía window.print().
 */

function isolatePrintableElement(elementId, bodyClass) {
  const printableElement = document.getElementById(elementId)
  if (!printableElement) {
    throw new Error(`No se encontró el elemento con ID '${elementId}' para imprimir.`)
  }

  const printElements = []
  const hideElements = []

  document.body.classList.add(bodyClass)
  let element = printableElement

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

  return {
    printableElement,
    restoreDom: () => {
      document.body.classList.remove(bodyClass)
      printElements.forEach((el) => el.classList.remove('ticket-print-ancestor'))
      hideElements.forEach((el) => el.classList.remove('ticket-print-hidden'))
    }
  }
}

/**
 * Imprime el comprobante térmico (80mm) in-page.
 *
 * @param {string} elementId Identificador DOM del contenedor a imprimir (por defecto 'printable-ticket')
 */
export function printThermalTicket(elementId = 'printable-ticket') {
  const printPageStyle = document.createElement('style')
  const { printableElement, restoreDom } = isolatePrintableElement(elementId, 'ticket-printing')

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener('afterprint', cleanup)
    restoreDom()
    printPageStyle.remove()
  }

  const ticketHeightMm = Math.ceil(
    (printableElement.getBoundingClientRect().height * 25.4) / 96 + 2
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

/**
 * Imprime etiquetas de estudios en rollo continuo (50-58mm, LP4206D) in-page
 * usando el mismo mecanismo de aislamiento + window.print() que printThermalTicket.
 *
 * @param {string} elementId Identificador DOM del contenedor de etiquetas
 * @param {{ onAfterPrint?: () => void }} options Callbacks del ciclo de impresión
 */
export function printStudyLabels(
  elementId = 'printable-study-labels',
  { onAfterPrint } = {}
) {
  const printPageStyle = document.createElement('style')
  const { printableElement, restoreDom } = isolatePrintableElement(elementId, 'labels-printing')

  let settled = false
  const cleanup = () => {
    if (settled) return
    settled = true
    window.removeEventListener('afterprint', handleAfterPrint)
    restoreDom()
    printPageStyle.remove()
  }

  const handleAfterPrint = () => {
    cleanup()
    onAfterPrint?.()
  }

  // Forzar reflow con body.labels-printing activo para medir la altura real del bloque oculto
  void printableElement.offsetHeight
  const rect = printableElement.getBoundingClientRect()
  const totalHeightMm = Math.max(20, Math.ceil((rect.height * 25.4) / 96 + 2))

  printPageStyle.textContent = `@page { size: 50mm ${totalHeightMm}mm; margin: 0; }`
  document.head.appendChild(printPageStyle)

  window.addEventListener('afterprint', handleAfterPrint, { once: true })

  try {
    window.print()
  } catch (error) {
    cleanup()
    throw error
  }
}
