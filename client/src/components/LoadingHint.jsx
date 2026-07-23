import { useEffect, useState } from 'react';

// After a few seconds, admits the server might be a free-tier instance
// waking up from sleep -- otherwise a slow cold start just looks broken.
const SLOW_THRESHOLD_MS = 4000;

export function LoadingHint() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="text-muted">
      불러오는 중...
      {slow && <div style={{ marginTop: 6, fontSize: 12 }}>서버가 잠시 대기 상태였다면 깨어나는 데 최대 1분 정도 걸릴 수 있습니다.</div>}
    </div>
  );
}
