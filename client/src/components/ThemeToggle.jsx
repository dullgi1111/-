import { useEffect, useState } from 'react';

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      title={theme === 'dark' ? '밝은 모드로 전환' : '어두운 모드로 전환'}
      aria-label="테마 전환"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
