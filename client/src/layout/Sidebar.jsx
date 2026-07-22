import { NavLink } from 'react-router-dom';

const NAV_GROUPS = [
  {
    label: '작업',
    items: [
      { to: '/', icon: '📊', label: '대시보드', end: true },
      { to: '/records', icon: '📋', label: '정비 이력' },
      { to: '/products', icon: '🏭', label: '제품 정보' },
      { to: '/upload', icon: '📥', label: '엑셀 업로드' },
    ],
  },
  {
    label: '데이터',
    items: [
      { to: '/dictionary', icon: '📖', label: '용어 사전', end: true },
      { to: '/dictionary/import', icon: '📑', label: '용어집 가져오기' },
      { to: '/equipment', icon: '🛠️', label: '설비 이력 조회' },
      { to: '/audit', icon: '🔀', label: '자동병합 로그' },
    ],
  },
  {
    label: '설정',
    items: [{ to: '/settings', icon: '⚙️', label: '설정' }],
  },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">정</div>
        <div>
          <div className="brand-name">설비정비 표준화</div>
          <div className="brand-sub">Term Normalizer</div>
        </div>
      </div>
      <nav className="nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
