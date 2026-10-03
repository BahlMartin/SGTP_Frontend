import React from 'react'
import './OnlineBoxesCard.css'

export default function OnlineBoxesCard({
  boxesList = [],
  isLoading = false,
  errorMessage = ''
}) {
  const getPillModifier = (estadoValue) => {
    const normalizedStatus = String(estadoValue || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    if (normalizedStatus === 'disponible') {
      return 'online-boxes-card__pill--disponible'
    }
    if (normalizedStatus === 'en atencion') {
      return 'online-boxes-card__pill--atencion'
    }
    return 'online-boxes-card__pill--fuera'
  }

  const orderedBoxes = [...boxesList].sort(
    (firstBox, secondBox) => Number(firstBox.numero) - Number(secondBox.numero)
  )

  return (
    <div className="online-boxes-card">
      <h3 className="online-boxes-card__title">Boxes en linea</h3>
      {isLoading ? (
        <p className="online-boxes-card__message" role="status">
          Cargando boxes...
        </p>
      ) : errorMessage ? (
        <p className="online-boxes-card__message online-boxes-card__message--error" role="alert">
          No se pudieron cargar los boxes: {errorMessage}
        </p>
      ) : orderedBoxes.length === 0 ? (
        <p className="online-boxes-card__message">
          No hay boxes registrados para mostrar.
        </p>
      ) : (
        <ul className="online-boxes-card__list">
          {orderedBoxes.map((boxItem) => {
            const status = boxItem.estado || (
              boxItem.activo === false ? 'Fuera de servicio' : 'Disponible'
            )

            return (
              <li key={boxItem.id ?? boxItem.numero} className="online-boxes-card__item">
                <span className="online-boxes-card__label">{boxItem.nombre}</span>
                <span className={`online-boxes-card__pill ${getPillModifier(status)}`}>
                  {status}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
