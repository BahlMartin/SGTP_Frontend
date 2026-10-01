import React from 'react'
import './OnlineBoxesCard.css'

export default function OnlineBoxesCard({ boxesList = [] }) {
  const getPillModifier = (estadoValue) => {
    if (estadoValue === 'Disponible') {
      return 'online-boxes-card__pill--disponible'
    }
    if (estadoValue === 'En atencion') {
      return 'online-boxes-card__pill--atencion'
    }
    return 'online-boxes-card__pill--fuera'
  }

  return (
    <div className="online-boxes-card">
      <h3 className="online-boxes-card__title">Boxes en linea</h3>
      <ul className="online-boxes-card__list">
        {boxesList.map((boxItem) => (
          <li key={boxItem.id} className="online-boxes-card__item">
            <span className="online-boxes-card__label">{boxItem.nombre}</span>
            <span className={`online-boxes-card__pill ${getPillModifier(boxItem.estado)}`}>
              {boxItem.estado}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
