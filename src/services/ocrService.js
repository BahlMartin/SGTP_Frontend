// Catálogo maestro de prácticas de laboratorio
export const MASTER_LAB_STUDIES = [
  { id: 'hemograma', nombre: 'Hemograma completo con recuento plaquetario', tipo: 'Sangre', categoria: 'Hemograma' },
  { id: 'glucemia', nombre: 'Glucemia en ayunas', tipo: 'Sangre', categoria: 'Bioquímica' },
  { id: 'hepatograma', nombre: 'Hepatograma (TGO, TGP, FAL, Bilirrubinas)', tipo: 'Sangre', categoria: 'Bioquímica' },
  { id: 'perfil_lipidico', nombre: 'Perfil Lipídico (Colesterol total, HDL, LDL, Triglicéridos)', tipo: 'Sangre', categoria: 'Bioquímica' },
  { id: 'orina_completa', nombre: 'Sedimento Urinario y Orina Completa', tipo: 'Orina', categoria: 'Orina' },
  { id: 'urocultivo', nombre: 'Urocultivo con Antibiograma', tipo: 'Orina', categoria: 'Cultivo' },
  { id: 'coagulograma', nombre: 'Coagulograma básico (KPTT, TP)', tipo: 'Sangre', categoria: 'Hemograma' },
  { id: 'creatinina', nombre: 'Creatinina y Urea plasmática', tipo: 'Sangre', categoria: 'Bioquímica' },
  { id: 'hisopado', nombre: 'Cultivo de Fauces / Hisopado bacteriológico', tipo: 'Bacteriología', categoria: 'Cultivo' },
  { id: 'marcador_tumoral', nombre: 'Marcadores Oncológicos (PSA / CEA / CA-125)', tipo: 'Sangre', categoria: 'Otro' }
]

/**
 * Simula la inferencia OCR On-Premise (PaddleOCR/TrOCR) en el perímetro local institucional.
 * Procesa la imagen en memoria volátil y devuelve el mapeo de estudios sugeridos
 * para el ciclo de revisión humana (Human-in-the-loop).
 */
export async function simulateOcrPrescriptionExtraction(imageFile) {
  // Simular tiempo de inferencia del modelo en servidor on-premise
  await new Promise((resolve) => setTimeout(resolve, 900))

  // Muestra representativa de estudios detectados por la IA en la receta
  const extractedSamples = [
    MASTER_LAB_STUDIES[0], // Hemograma
    MASTER_LAB_STUDIES[1], // Glucemia
    MASTER_LAB_STUDIES[4]  // Orina completa
  ]

  return {
    success: true,
    confidence: 0.94,
    extractedRawText: 'Rp./ Hemograma completo, Glucemia basal, Orina completa con sedimento. Dx: Control anual.',
    suggestedStudies: extractedSamples
  }
}
