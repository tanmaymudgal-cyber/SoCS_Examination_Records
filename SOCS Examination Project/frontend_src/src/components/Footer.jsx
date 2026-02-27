import React from 'react';

export default function Footer() {
  return (
    <footer className="dev-credits" style={{ 
      padding: '24px', 
      textAlign: 'center', 
      borderTop: '1px solid var(--border)', 
      marginTop: 'auto',
      color: 'var(--text-muted)',
      fontSize: '0.9rem'
    }}>
      <p>
        Engineered by{' '}
        <a 
          href="https://www.linkedin.com/in/tanmay-mudgal-4a3755310" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          Tanmay Mudgal
        </a>
        {' '}&amp;{' '}
        <a 
          href="https://www.linkedin.com/in/aryan-kush-492920352" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          Aryan Kush
        </a>
      </p>
    </footer>
  );
}
