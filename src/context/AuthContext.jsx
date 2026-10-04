import { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { loginApi, logoutApi } from '../services/authService'

const STORAGE_KEY = 'sgtp_session_user'

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

  useEffect(() => {
    const handleUnauthorized = () => {
      setUserData(null)
      setIsLogged(false)
      try {
        localStorage.removeItem(STORAGE_KEY)
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
