const isProduction = import.meta.env.PROD

const ENVIRONMENT = {
  // En producción (Vercel) utiliza '/api' (proxy inverso en vercel.json) para no exponer el backend real ni tener CORS.
  // En desarrollo local o si se define en .env, utiliza VITE_API_URL o fallback a '/api' (gestionado por proxy en vite.config.js).
  URL_API: import.meta.env.VITE_API_URL || '/api',
  ENABLE_JWE: import.meta.env.VITE_ENABLE_JWE === 'true',
  OCR_SERVICE_URL: import.meta.env.VITE_OCR_SERVICE_URL || 'http://localhost:8001/ocr',
  APP_NAME: 'SGTP - Sistema de Gestión de Triage y Flujo de Pacientes',
  VERSION: '1.0.0'
}

export default ENVIRONMENT

