import React from 'react'
import './LabMatrixCard.css'

export default function LabMatrixCard({ labMatrix = [] }) {
  return (
    <div className="jefa-screen__matrix-card">
      <h3 className="jefa-screen__section-title">Estudios laboratorios</h3>
      <div className="jefa-screen__matrix-table">
        {labMatrix.map((matrixItem) => (
          <div key={matrixItem.nombre} className="jefa-screen__matrix-row">
            <div className="jefa-screen__matrix-cat">
              <span className="jefa-screen__matrix-cat-name">{matrixItem.nombre}</span>
              <span className="jefa-screen__matrix-cat-total">{matrixItem.total} Total</span>
            </div>
            <div className="jefa-screen__matrix-tags">
              <div className="jefa-screen__matrix-tag jefa-screen__matrix-tag--pend">
                <span className="jefa-screen__matrix-tag-val">{matrixItem.pend}</span>
                <span className="jefa-screen__matrix-tag-lbl">Pend.</span>
              </div>
              <div className="jefa-screen__matrix-tag jefa-screen__matrix-tag--curso">
                <span className="jefa-screen__matrix-tag-val">{matrixItem.curso}</span>
                <span className="jefa-screen__matrix-tag-lbl">Curso</span>
              </div>
              <div className="jefa-screen__matrix-tag jefa-screen__matrix-tag--listos">
                <span className="jefa-screen__matrix-tag-val">{matrixItem.listos}</span>
                <span className="jefa-screen__matrix-tag-lbl">Listos</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
