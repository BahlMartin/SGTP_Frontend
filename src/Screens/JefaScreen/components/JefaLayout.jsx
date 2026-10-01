import React from 'react'
import Navbar from '../../../components/Navbar/Navbar'
import './JefaLayout.css'

export default function JefaLayout({
  headerContent,
  leftContent,
  centerContent,
  searchContent
}) {
  return (
    <div className="jefa-screen">
      <Navbar />
      <main className="jefa-screen__main">
        {headerContent}
        <div className="jefa-screen__grid">
          <div className="jefa-screen__left-column">{leftContent}</div>
          <div className="jefa-screen__center-column">{centerContent}</div>
        </div>
        <div className="jefa-screen__search-panel">{searchContent}</div>
      </main>
    </div>
  )
}
