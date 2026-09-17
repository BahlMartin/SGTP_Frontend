const ENVIRONMENT = {
  URL_API: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  ENABLE_JWE: import.meta.env.VITE_ENABLE_JWE === 'true',
  OCR_SERVICE_URL: import.meta.env.VITE_OCR_SERVICE_URL || 'http://localhost:8001/ocr',
  APP_NAME: 'SGTP - Sistema de Gestión de Triage y Flujo de Pacientes',
  VERSION: '1.0.0'
}

export default ENVIRONMENT
