# 🚀 Guía de Despliegue en Vercel: Proxy Inverso, Variables y Ocultamiento de la API

Esta guía detalla la arquitectura y los pasos para desplegar el frontend de **SGTP** en **Vercel**, enmascarando la dirección real del Backend, resolviendo problemas de **CORS** y gestionando entornos de forma segura.

---

## 1. ¿Por qué el Frontend por sí solo no puede ocultar URLs?

1. **Compilación en el cliente**: Todo lo que compila Vite (import.meta.env.VITE_*) se inyecta como texto plano en los archivos .js que el navegador descarga.
2. **Inspección de red**: Cuando el navegador ejecuta un etch o xios directo a https://mi-backend.com/api/tickets, esa URL viaja desde la máquina del cliente y queda registrada en la pestaña **Network (F12)** del navegador.

### 🛡️ Solución: Vercel como Reverse Proxy (Proxy Inverso)
Al configurar **Vercel Rewrites**, Vercel actúa como intermediario:
- El navegador solo solicita: https://tu-app.vercel.app/api/...
- Los servidores perimetrales de Vercel toman la petición y la reenvían internamente a tu servidor backend real (https://tu-backend-api.com/api/...).
- **El cliente nunca conoce la IP o dominio real de tu backend.**

`
+----------------+                +---------------------+                +--------------------+
|                |   /api/tickets |                     |   /api/tickets |                    |
|   Navegador    | -------------> |    Vercel Edge      | -------------> |   Servidor Backend |
|   (Cliente)    | <------------- | (Reverse Proxy)     | <------------- |  (Privado/Oculto)  |
|                |    Respuesta   |                     |    Respuesta   |                    |
+----------------+                +---------------------+                +--------------------+
 (Solo ve tu-app.vercel.app)
`

---

## 2. Archivos Implementados en el Proyecto

### A. [ercel.json](file:///vercel.json)
Ubicado en la raíz del proyecto, define las reglas de redirección y proxy:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://tu-backend-api.com/app/$1"
    },
    {
      "source": "/api",
      "destination": "https://tu-backend-api.com/app/"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

> ⚠️ **Importante**:
> - Reemplaza https://tu-backend-api.com por la URL o IP pública de tu servidor backend real (ej. https://sgtp-api.onrender.com o https://api.tuinstitucion.gob.ar).
> - Si tu backend **no** tiene el prefijo /api en sus rutas (ej. responde directamente en /tickets), cambia el destino a "https://tu-backend-api.com/:path*".
> - La regla /api/:path* debe estar siempre **arriba** de "/(.*)", para que no sea interceptada por la regla de SPA.

---

### B. [src/config/enviroment.config.js](file:///src/config/enviroment.config.js)
El frontend detecta si está corriendo en producción (import.meta.env.PROD):

\\\javascript
const isProduction = import.meta.env.PROD

const ENVIRONMENT = {
  // En producción (Vercel) utiliza '/api' (proxy inverso en vercel.json)
  // En desarrollo local utiliza VITE_API_URL o fallback a 'http://localhost:8000'
  URL_API: import.meta.env.VITE_API_URL || (isProduction ? '/api' : 'http://localhost:8000'),
  ENABLE_JWE: import.meta.env.VITE_ENABLE_JWE === 'true',
  OCR_SERVICE_URL: import.meta.env.VITE_OCR_SERVICE_URL || 'http://localhost:8001/ocr',
  APP_NAME: 'SGTP - Sistema de Gestión de Triage y Flujo de Pacientes',
  VERSION: '1.0.0'
}

export default ENVIRONMENT
\\\

---

### C. [ite.config.js](file:///vite.config.js) (Para Desarrollo Local)
Permite que en tu máquina (localhost) las peticiones a /api se redirijan automáticamente a tu backend local en el puerto 8000:

\\\javascript
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
\\\

---

## 3. Configuración en el Dashboard de Vercel

Si en el futuro deseas sobreescribir variables de entorno en Vercel:

1. Ingresa a tu panel en [vercel.com](https://vercel.com).
2. Selecciona tu proyecto (SGTP_Frontend).
3. Ve a la pestaña **Settings** (Configuración) y haz clic en **Environment Variables**.
4. Agrega las claves deseadas según corresponda:
   - VITE_API_URL (Opcional si usas el proxy /api).
   - VITE_ENABLE_JWE (	rue o alse).
   - VITE_OCR_SERVICE_URL (URL del microservicio OCR).
5. Selecciona los entornos a aplicar: **Production**, **Preview** y/o **Development**.
6. Guarda y realiza un nuevo **Redeploy** para que los cambios tomen efecto.

---

## 4. Beneficios Clave de esta Arquitectura

| Beneficio | Descripción |
| :--- | :--- |
| **Enmascaramiento de Infraestructura** | Los usuarios solo ven llamadas a /api/.... La IP, puerto y proveedor real del backend quedan completamente ocultos. |
| **Solución Definitiva de CORS** | Al viajar a través del mismo dominio (https://tu-app.vercel.app), el navegador interpreta que ambas partes pertenecen al mismo origen (*Same-Origin*). |
| **SSL / HTTPS Unificado** | Todo el tráfico entre el usuario y Vercel queda cifrado bajo el certificado TLS/SSL automático de Vercel. |
| **Transparencia en Desarrollo** | Mismo código tanto en tu computadora local como en la nube de producción. |

---

## 5. Lista de Comprobación previa al Despliegue (Checklist)

- [ ] Editar ercel.json y colocar el dominio real de tu backend en el campo destination.
- [ ] Asegurarse de que el backend tenga activada la recepción de encabezados X-Forwarded-For y X-Forwarded-Proto si realiza validación de origen o IP de clientes.
- [ ] Hacer git push a la rama principal (main o master) vinculada a Vercel.
