import { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { loginApi, logoutApi, fetchCurrentSessionApi } from '../services/authService'

const STORAGE_KEY = 'sgtp_session_user'
const TOKEN_KEY = 'token'

export const AuthContext = createContext({
  isLogged: false,
  userData: null,
  login: async () => {},
  logout: async () => {}
})

export const AuthContextProvider = ({ children }) => {
  const [userData, setUserData] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [isLogged, setIsLogged] = useState(() => {
    return Boolean(localStorage.getItem(STORAGE_KEY))
  })

  // Sincronizar y rehidratar token de sesión en arranque
  useEffect(() => {
    // Si ya existe en localStorage pero no en sessionStorage, copiarlo
    const localToken = localStorage.getItem(TOKEN_KEY)
    if (localToken && !sessionStorage.getItem(TOKEN_KEY)) {
      sessionStorage.setItem(TOKEN_KEY, localToken)
    }

    // Si el usuario está marcado como logueado o tiene cookie de sesión, recuperar token fresco del backend
    if (isLogged || localToken || (typeof document !== 'undefined' && document.cookie.includes('sessionid'))) {
      fetchCurrentSessionApi().then((res) => {
        if (res && res.token) {
          sessionStorage.setItem(TOKEN_KEY, res.token)
          localStorage.setItem(TOKEN_KEY, res.token)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:token_ready', { detail: { token: res.token } }))
          }
        }
      }).catch(() => {
        // Ignorar fallos de red silenciosos al verificar sesión
      })
    }
  }, [isLogged])


  useEffect(() => {
    const handleUnauthorized = () => {
      setUserData(null)
      setIsLogged(false)
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
      } catch (e) {
        console.warn('Error al limpiar almacenamiento local:', e)
      }
    }

    const handleStorageChange = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return

      if (!event.newValue) {
        setUserData(null)
        setIsLogged(false)
        return
      }

      try {
        const nextUserData = JSON.parse(event.newValue)
        if (!nextUserData || typeof nextUserData !== 'object' || !nextUserData.id) {
          throw new Error('Los datos de sesión no contienen un usuario válido.')
        }
        setUserData(nextUserData)
        setIsLogged(true)
      } catch (error) {
        console.error('No se pudo sincronizar la sesión entre pestañas:', error)
        setUserData(null)
        setIsLogged(false)
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await loginApi(email, password)
    setUserData(res.user)
    setIsLogged(true)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user))
      
      // Guardar el token en sessionStorage y localStorage
      if (res.token) {
        sessionStorage.setItem(TOKEN_KEY, res.token)
        localStorage.setItem(TOKEN_KEY, res.token)
      }
      
    } catch (e) {
      console.warn('No se pudo guardar la sesión en almacenamiento local:', e)
    }
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } finally {
      setUserData(null)
      setIsLogged(false)
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
      } catch (e) {
        console.warn('Error al limpiar almacenamiento local:', e)
      }
    }
  }, [])


  return (
    <AuthContext.Provider
      value={{
        isLogged,
        userData,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
