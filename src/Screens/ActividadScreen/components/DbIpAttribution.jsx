import React from 'react'

export default function DbIpAttribution() {
  return (
    <footer
      style={{
        marginTop: '24px',
        paddingTop: '12px',
        borderTop: '1px solid var(--auditoria-border-subtle, #edf2f5)',
        fontSize: '11px',
        color: 'var(--auditoria-text-light, #94a3a8)',
        textAlign: 'center'
      }}
    >
      Geolocalización IP provista por{' '}
      <a
        href="https://db-ip.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--auditoria-primary, #1687c9)', textDecoration: 'none' }}
      >
        DB-IP
      </a>{' '}
      (bajo licencia Creative Commons Attribution 4.0). Auditoría de seguridad clínica y trazabilidad de acciones operacionales.
    </footer>
  )
}

