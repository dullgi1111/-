import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const TITLES = {
  '/': '대시보드',
  '/records': '정비 이력',
  '/manual-entry': '수동 입력',
  '/upload': '엑셀 업로드',
  '/dictionary': '용어 사전',
  '/dictionary/import': '용어집 가져오기',
  '/equipment': '설비 이력 조회',
  '/audit': '자동병합 로그',
  '/settings': '설정',
};

function resolveTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = '/' + pathname.split('/')[1];
  return TITLES[base] || '설비정비 표준화';
}

export function AppShell() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="page-title">{resolveTitle(location.pathname)}</div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
