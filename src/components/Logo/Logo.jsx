import React from 'react'
import './Logo.css'

export default function Logo({ onClick, withText = false, className = '' }) {
  return (
    <div
      className={`logo ${onClick ? 'logo--clickable' : ''} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="logo__box">
        <svg
          className="logo__icon"
          viewBox="0 0 40 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M2 12H10L14 3L18 21L23 8L27 15L29 12H38"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {withText && <span className="logo__text">SGTP</span>}
    </div>
  )
}
