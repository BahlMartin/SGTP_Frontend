import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchBoxesApi, updateBoxStateApi } from '../services/boxService'

export const BoxContext = createContext({
  boxes: [],
  currentBoxNumber: 1,
  setCurrentBoxNumber: () => {},
  changeBoxStatus: async () => {},
  refreshBoxes: async () => {}
})

export const BoxContextProvider = ({ children }) => {
  const [boxes, setBoxes] = useState([])
  const [currentBoxNumber, setCurrentBoxNumber] = useState(1)

  const refreshBoxes = useCallback(async () => {
    try {
      const data = await fetchBoxesApi()
      setBoxes(data)
    } catch (error) {
      console.error('Error fetching boxes:', error)
    }
  }, [])

  useEffect(() => {
    refreshBoxes()
  }, [refreshBoxes])

  const changeBoxStatus = useCallback(async (boxNumero, nuevoEstado) => {
    try {
      const updatedBox = await updateBoxStateApi(boxNumero, nuevoEstado)
      setBoxes((previousBoxes) =>
        previousBoxes.map((currentBox) =>
          currentBox.numero === Number(boxNumero) ? updatedBox : currentBox
        )
      )
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
