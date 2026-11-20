// Instalar interceptor temprano antes de cargar módulos que inicializan Emscripten/ONNX Runtime
if (typeof window !== 'undefined' && !window.__onnx_warn_filtered) {
  window.__onnx_warn_filtered = true
  const ONNX_NOISE_PATTERNS = [
    'onnxruntime',
    '[W:onnxruntime:',
    'CleanUnusedInitializersAndNodeArgs',
    'Removing initializer',
    'p2o.pd_op.full_int_array'
  ]
  const shouldFilterOnnxLog = (args) =>
    args.some((arg) => {
      const text =
        typeof arg === 'string'
          ? arg
          : typeof arg?.message === 'string'
            ? arg.message
            : ''
      return Boolean(text) && ONNX_NOISE_PATTERNS.some((pattern) => text.includes(pattern))
    })

  for (const method of ['warn', 'error', 'log', 'info', 'debug']) {
    const originalMethod = console[method]
    if (typeof originalMethod === 'function') {
      console[method] = (...args) => {
        if (shouldFilterOnnxLog(args)) return
        originalMethod.apply(console, args)
      }
    }
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
