import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SplashScreen } from '../components/SplashScreen';
import { ThemeToggle } from '../components/ThemeToggle';

const TITLES = {
  '/': '대시보드',
  '/records': '정비 이력',
  '/products': '제품 정보',
  '/upload': '엑셀 업로드',
  '/dictionary': '용어 사전',
  '/dictionary/import': '용어집 가져오기',
  '/classification-map': '정비유형 판정표',
  '/equipment': '설비 이력 조회',
  '/inventory': '재고 관리',
  '/reports': '리포트',
  '/audit': '자동병합 로그',
  '/settings': '설정',
};

function resolveTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = '/' + pathname.split('/')[1];
  return TITLES[base] || 'KEP 설비정비 표준화';
}

export function AppShell() {
  const location = useLocation();
  const [showStartupNotice, setShowStartupNotice] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="app-shell">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="page-title">{resolveTitle(location.pathname)}</div>
          <ThemeToggle />
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>

      {showStartupNotice && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="modal" style={{ width: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>로딩 지연 안내</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 20 }}>
              무료 서버 특성상 첫 접속 시 대시보드나 다른 화면 이동이 최대 1분 정도 느릴 수 있습니다.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowStartupNotice(false)}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
