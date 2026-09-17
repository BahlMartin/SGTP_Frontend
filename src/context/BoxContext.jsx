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
    } catch (err) {
      console.error('Error fetching boxes:', err)
    }
  }, [])

  useEffect(() => {
    refreshBoxes()
  }, [refreshBoxes])

  const changeBoxStatus = useCallback(async (boxNum, newStatus) => {
    try {
      const updated = await updateBoxStateApi(boxNum, newStatus)
      setBoxes((prev) => prev.map((b) => (b.numero === Number(boxNum) ? updated : b)))
      return updated
    } catch (err) {
      console.error('Error updating box status:', err)
      throw err
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
