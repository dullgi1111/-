import { useEffect, useState } from 'react';
import logo from '../assets/kep_logo.png';

export function SplashScreen({ onDone, holdMs = 1600 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), holdMs);
    const doneTimer = setTimeout(() => onDone?.(), holdMs + 400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [holdMs, onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <img src={logo} alt="KEP" style={{ maxWidth: 260, maxHeight: 170, marginBottom: 22 }} />
      <div style={{ fontSize: 19, fontWeight: 700, color: '#1e293b' }}>KEP 설비정비 표준화</div>
    </div>
  );
}
