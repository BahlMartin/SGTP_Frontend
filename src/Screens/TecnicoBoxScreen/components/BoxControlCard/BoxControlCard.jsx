import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Tv } from 'lucide-react'
import './BoxControlCard.css'

export default function BoxControlCard({
  boxesList = [],
  currentBoxNumber,
  onSelectBox,
  currentStatus,
  onStatusChange,
  disabled = false
}) {
  const [isBoxListOpen, setIsBoxListOpen] = useState(false)
  const selectorRef = useRef(null)

  const availableBoxes = useMemo(() => {
    const boxesByNumber = new Map(
      boxesList
        .filter((box) => Number.isFinite(Number(box.numero)))
        .map((box) => [Number(box.numero), box])
    )

    if (!boxesByNumber.has(Number(currentBoxNumber))) {
      boxesByNumber.set(Number(currentBoxNumber), {
        numero: Number(currentBoxNumber),
        nombre: `Box ${currentBoxNumber}`
      })
    }

    return Array.from(boxesByNumber.values()).sort(
      (firstBox, secondBox) => Number(firstBox.numero) - Number(secondBox.numero)
    )
  }, [boxesList, currentBoxNumber])

  useEffect(() => {
    const handleClickOutside = (mouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(mouseEvent.target)) {
        setIsBoxListOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectorKeyDown = (keyboardEvent) => {
    if (keyboardEvent.key === 'Escape') {
      setIsBoxListOpen(false)
    } else if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault()
      setIsBoxListOpen(true)
    }
  }

  return (
    <div className="box-control-card">
      <div className="box-control-card__header">
        <Tv className="box-control-card__header-icon" />
        <h2 className="box-control-card__title">Panel de control de box</h2>
      </div>

      <div className="box-control-card__select-group">
        <span className="box-control-card__select-label">
          Box asignado
        </span>
        <div className="box-control-card__selector" ref={selectorRef}>
          <button
            id="box-assigned-select"
            type="button"
            className="box-control-card__select-input"
            aria-haspopup="listbox"
            aria-expanded={isBoxListOpen}
            aria-controls="box-assigned-options"
            onClick={() => setIsBoxListOpen((isOpen) => !isOpen)}
            onKeyDown={handleSelectorKeyDown}
            disabled={disabled}
          >
            <span>Box {currentBoxNumber}</span>
            <ChevronDown
              className={`box-control-card__select-icon ${
                isBoxListOpen ? 'box-control-card__select-icon--open' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {isBoxListOpen && (
            <ul
              id="box-assigned-options"
              className="box-control-card__options"
              role="listbox"
              aria-label="Seleccionar box"
            >
              {availableBoxes.map((box) => {
                const boxNumber = Number(box.numero)
                const isSelected = boxNumber === Number(currentBoxNumber)

                return (
                  <li key={boxNumber} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`box-control-card__option ${
                        isSelected ? 'box-control-card__option--selected' : ''
                      }`}
                      onClick={() => {
                        onSelectBox(boxNumber)
                        setIsBoxListOpen(false)
                      }}
                    >
                      {box.nombre || `Box ${boxNumber}`}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="box-control-card__status-buttons">
        <button
          type="button"
          className={`box-control-card__status-btn box-control-card__status-btn--disponible ${
            currentStatus === 'Disponible' ? 'box-control-card__status-btn--disponible-active' : ''
          }`}
          onClick={() => onStatusChange('Disponible')}
          disabled={disabled}
        >
          Disponible
        </button>
        <button
          type="button"
          className={`box-control-card__status-btn box-control-card__status-btn--atencion ${
            currentStatus === 'En atencion' ? 'box-control-card__status-btn--atencion-active' : ''
          }`}
          onClick={() => onStatusChange('En atencion')}
          disabled={disabled}
        >
          En atencion
        </button>
        <button
          type="button"
          className={`box-control-card__status-btn box-control-card__status-btn--fuera ${
            currentStatus === 'Fuera de servicio' ? 'box-control-card__status-btn--fuera-active' : ''
          }`}
          onClick={() => onStatusChange('Fuera de servicio')}
          disabled={disabled}
        >
          Fuera de servicio
        </button>
      </div>
    </div>
  )
}
