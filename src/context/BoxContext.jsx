import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchBoxesApi, updateBoxStateApi } from '../services/boxService'

export const BoxContext = createContext({
  boxes: [],
  boxesLoading: false,
  boxesError: '',
  currentBoxNumber: 1,
  setCurrentBoxNumber: () => {},
  changeBoxStatus: async () => {},
  refreshBoxes: async () => {}
})

export const BoxContextProvider = ({ children }) => {
  const { isLogged } = useAuth()
  const [boxes, setBoxes] = useState([])
  const [boxesLoading, setBoxesLoading] = useState(false)
  const [boxesError, setBoxesError] = useState('')
  const [currentBoxNumber, setCurrentBoxNumber] = useState(1)

  const refreshBoxes = useCallback(async () => {
    setBoxesLoading(true)
    setBoxesError('')
    try {
      const data = await fetchBoxesApi()
      setBoxes(data)
    } catch (error) {
      console.error('Error fetching boxes:', error)
      setBoxesError(error.message || 'No se pudo cargar la lista de boxes.')
    } finally {
      setBoxesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLogged) {
      refreshBoxes()
    } else {
      setBoxes([])
      setBoxesError('')
      setBoxesLoading(false)
    }
  }, [isLogged, refreshBoxes])

  const changeBoxStatus = useCallback(async (boxNumero, nuevoEstado) => {
    try {
      const updatedBox = await updateBoxStateApi(boxNumero, nuevoEstado)
      setBoxes((previousBoxes) => {
        const matchingBoxIndex = previousBoxes.findIndex(
          (currentBox) => Number(currentBox.numero) === Number(boxNumero)
        )
        if (matchingBoxIndex < 0) return [...previousBoxes, updatedBox]

        return previousBoxes.map((currentBox, index) =>
          index === matchingBoxIndex ? { ...currentBox, ...updatedBox } : currentBox
        )
      })
      return updatedBox
    } catch (error) {
      console.error('Error updating box status:', error)
      throw error
    }
  }, [])

  return (
    <BoxContext.Provider
      value={{
        boxes,
        boxesLoading,
        boxesError,
        currentBoxNumber,
        setCurrentBoxNumber,
        changeBoxStatus,
        refreshBoxes
      }}
    >
      {children}
    </BoxContext.Provider>
  )
}

export const useBox = () => useContext(BoxContext)
