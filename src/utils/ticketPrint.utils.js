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

export function printStudyLabels(
  elementId = 'printable-study-labels',
  { onAfterPrint, onWindowClose } = {}
) {
  const printableLabels = document.getElementById(elementId)
  if (!printableLabels) {
    throw new Error(`No se encontró el elemento con ID '${elementId}' para imprimir.`)
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.')
  }

  printWindow.opener = null
  printWindow.document.open()
  printWindow.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vista previa de etiquetas</title></head><body></body></html>'
  )
  printWindow.document.close()

  const printStyle = printWindow.document.createElement('style')
  printStyle.textContent = `
    @page { size: 50mm 20mm; margin: 0; }
    html, body { min-height: 100%; margin: 0; padding: 0; }
    body { background: #e2e8f0; color: #0f172a; font-family: Arial, sans-serif; }
    .labels-preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 20px;
      background: #fff;
      box-shadow: 0 1px 5px rgba(15, 23, 42, 0.14);
    }
    .labels-preview-toolbar span { font-size: 14px; font-weight: 600; }
    .labels-preview-toolbar button {
      border: 0;
      border-radius: 6px;
      padding: 9px 14px;
      background: #0369a1;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .labels-preview-sheet {
      box-sizing: border-box;
      width: 50mm;
      margin: 20px auto;
      background: #fff;
      box-shadow: 0 2px 12px rgba(15, 23, 42, 0.2);
    }
    #printable-study-labels { display: block; width: 50mm; }
    .ticket-study-label {
      box-sizing: border-box;
      width: 50mm;
      height: 20mm;
      padding: 1.4mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.5mm;
      overflow: hidden;
      color: #000;
      background: #fff;
      font-family: Arial, sans-serif;
      line-height: 1.05;
      border-bottom: 0.25mm dashed #94a3b8;
      page-break-after: always;
      break-after: page;
    }
    .ticket-study-label:last-child {
      border-bottom: 0;
      page-break-after: auto;
      break-after: auto;
    }
    .ticket-study-label__patient,
    .ticket-study-label__study {
      overflow: hidden;
      font-size: 8pt;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ticket-study-label__dni,
    .ticket-study-label__sample { font-size: 6.5pt; }
    @media print {
      html, body { width: 50mm; min-height: 0; background: #fff; }
      .labels-preview-toolbar { display: none; }
      .labels-preview-sheet { width: 50mm; margin: 0; box-shadow: none; }
    }
  `
  printWindow.document.head.appendChild(printStyle)
  const toolbar = printWindow.document.createElement('header')
  toolbar.className = 'labels-preview-toolbar'
  const instructions = printWindow.document.createElement('span')
  instructions.textContent = 'Vista previa: todas las etiquetas en una hoja'
  const printButton = printWindow.document.createElement('button')
  printButton.type = 'button'
  printButton.textContent = 'Imprimir etiquetas'
  toolbar.append(instructions, printButton)

  const previewSheet = printWindow.document.createElement('main')
  previewSheet.className = 'labels-preview-sheet'
  previewSheet.appendChild(printWindow.document.importNode(printableLabels, true))
  printWindow.document.body.append(toolbar, previewSheet)

  let settled = false
  let closeCheckId = null
  const cleanup = () => {
    if (closeCheckId !== null) {
      window.clearInterval(closeCheckId)
      closeCheckId = null
    }
    printWindow.removeEventListener('afterprint', handleAfterPrint)
  }
  const handleAfterPrint = () => {
    if (settled) return
    settled = true
    cleanup()
    onAfterPrint?.()
    printWindow.close()
  }

  printWindow.addEventListener('afterprint', handleAfterPrint, { once: true })
  printButton.addEventListener('click', () => {
    printWindow.focus()
    printWindow.print()
  })
  closeCheckId = window.setInterval(() => {
    if (!printWindow.closed || settled) return
    settled = true
    cleanup()
    onWindowClose?.()
  }, 250)

  try {
    printWindow.focus()
  } catch (error) {
    cleanup()
    printWindow.close()
    throw error
  }
}
