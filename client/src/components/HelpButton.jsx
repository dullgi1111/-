import { useState } from 'react';
import { Modal } from './Modal';

// Small "?" button that opens a modal with a plain-language explanation.
// Use for any concept a first-time user might not recognize from a demo alone.
export function HelpButton({ title, width = 480, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`${title} 자세히 보기`}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title={title} width={width}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>
            {children}
          </div>
        </Modal>
      )}
    </>
  );
}

export function HelpSection({ heading, children }) {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>{heading}</div>
      {children}
    </div>
  );
}
