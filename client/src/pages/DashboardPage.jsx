import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as dashboardApi from '../api/dashboard.api';
import * as recordsApi from '../api/records.api';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { TrendChart, TrendLegend } from '../components/TrendChart';
import { LoadingHint } from '../components/LoadingHint';
import { Modal } from '../components/Modal';

const TABS = [
  { key: 'stats', label: '통계' },
  { key: 'breakdowns', label: '최근 고장수리 이력' },
  { key: 'stale', label: '정비 안 된 지 오래된 설비' },
];

const STALE_ALERT_DAYS = 30;

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function AlertBell({ alerts, open, onToggle, onSelect }) {
  const totalCount = alerts.reduce((sum, a) => sum + a.count, 0);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={onToggle}
        aria-label="알림"
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: 17,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow)',
        }}
      >
        📬
        {totalCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 17,
              height: 17,
              padding: '0 4px',
              borderRadius: 10,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 140 }} onClick={onToggle} />
          <div
            style={{
              position: 'absolute',
              top: 46,
              right: 0,
              width: 300,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 12px 34px rgba(0,0,0,.18)',
              zIndex: 150,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 700, borderBottom: '1px solid var(--border2)' }}>
              알림 {alerts.length > 0 ? `${alerts.length}건` : ''}
            </div>
            {alerts.length === 0 ? (
              <div className="text-muted" style={{ padding: '18px 14px', fontSize: 12.5 }}>
                확인할 알림이 없습니다.
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.key}
                  onClick={() => onSelect(a)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{a.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--warn)',
                      background: 'var(--warn-bg)',
                      borderRadius: 10,
                      padding: '2px 8px',
                      flexShrink: 0,
                    }}
                  >
                    {a.count}건
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [summary, setSummary] = useState(null);
  const [recentBreakdowns, setRecentBreakdowns] = useState([]);
  const [trends, setTrends] = useState([]);
  const [equipmentStats, setEquipmentStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showAlertDropdown, setShowAlertDropdown] = useState(false);
  const [highlightStale, setHighlightStale] = useState(false);
  const [acknowledgedStaleIds, setAcknowledgedStaleIds] = useState(new Set());

  useEffect(() => {
    Promise.all([
      dashboardApi.getSummary(),
      recordsApi.listRecords({ maintenanceType: 'breakdown_repair', limit: 15 }),
      dashboardApi.getTrends(),
      dashboardApi.getEquipmentStats(),
    ])
      .then(([summaryData, breakdownsData, trendsData, equipmentStatsData]) => {
        setSummary(summaryData);
        setRecentBreakdowns(breakdownsData);
        setTrends(trendsData);
        setEquipmentStats(equipmentStatsData);
        const years = [...new Set(trendsData.map((r) => new Date(r.month).getFullYear()))].sort();
        if (years.length > 0) setSelectedYear(years[years.length - 1]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingHint />;
  if (error) return <EmptyState>데이터를 불러오지 못했습니다: {error}</EmptyState>;

  const byType = Object.fromEntries((summary.byType || []).map((r) => [r.maintenance_type, r.count]));
  const trendYears = [...new Set(trends.map((r) => new Date(r.month).getFullYear()))].sort();
  const yearTrends = trends.filter((r) => new Date(r.month).getFullYear() === selectedYear);
  const staleEquipment = [...equipmentStats]
    .filter((e) => e.last_record_date)
    .sort((a, b) => new Date(a.last_record_date) - new Date(b.last_record_date))
    .slice(0, 15);
  const staleAlertCount = equipmentStats.filter((e) => (daysSince(e.last_record_date) ?? 0) > STALE_ALERT_DAYS).length;

  const alerts = [
    {
      key: 'lowStock',
      count: summary.lowStockCount,
      label: '재고 부족 부품',
      description: '재고 수량이 설정해둔 재주문 기준 이하로 떨어진 부품입니다. 발주가 필요한지 확인해주세요.',
      goTo: () => navigate(`/inventory?lowStockOnly=true&highlight=${Date.now()}`),
    },
    {
      key: 'typeReview',
      count: summary.needsTypeReviewCount,
      label: '정비 유형 확인 필요',
      description: '시스템이 키워드로 자동 추정한 정비 유형(고장수리/예방점검 등)을 아직 사람이 확인하지 않은 정비 이력입니다.',
      goTo: () => navigate(`/records?needsTypeReview=true&highlight=${Date.now()}`),
    },
    {
      key: 'equipReview',
      count: summary.needsReviewEquipmentCount,
      label: '설비 정보 확인 필요',
      description: '정비 이력에서 자동으로 발견된 설비명입니다. 사양 정보를 입력하고 확인하면 목록에서 빠집니다.',
      goTo: () => navigate(`/products?needsReview=true&highlight=${Date.now()}`),
    },
    {
      key: 'stale',
      count: staleAlertCount,
      label: `${STALE_ALERT_DAYS}일 이상 정비 안 된 설비`,
      description: `최근 ${STALE_ALERT_DAYS}일 동안 정비 이력이 등록되지 않은 설비입니다. 점검이 밀린 건 아닌지 확인해주세요.`,
      goTo: () => {
        setActiveTab('stale');
        setHighlightStale(true);
        setAcknowledgedStaleIds(new Set());
      },
    },
  ].filter((a) => a.count > 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14, flexShrink: 0 }}>
        <div className="stat-row" style={{ flex: 1, marginBottom: 0 }}>
          <StatCard label="전체 정비 이력" value={summary.totalRecords} color="var(--accent)" />
          <StatCard label="고장수리" value={byType.breakdown_repair || 0} color="var(--danger)" />
          <StatCard label="예방점검" value={byType.preventive_inspection || 0} color="var(--ok)" />
          <StatCard label="검토 필요 용어" value={summary.needsReviewTerms} sub="사전에서 확인" color="var(--warn)" />
          <StatCard label="이번 주 업로드 배치" value={summary.batchesThisWeek} color="var(--purple)" />
        </div>
        <AlertBell
          alerts={alerts}
          open={showAlertDropdown}
          onToggle={() => setShowAlertDropdown((v) => !v)}
          onSelect={(a) => {
            setShowAlertDropdown(false);
            setSelectedAlert(a);
          }}
        />
      </div>

      {selectedAlert && (
        <Modal onClose={() => setSelectedAlert(null)} title={selectedAlert.label} width={440}>
          <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              {selectedAlert.count}건이 확인을 기다리고 있습니다.
            </div>
            {selectedAlert.description}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAlert(null)}>
              무시하고 진행
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                selectedAlert.goTo();
                setSelectedAlert(null);
              }}
            >
              확인하러 가기
            </button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexShrink: 0 }}>
        {TABS.map((t) => (
          <span key={t.key} className={`chip${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'breakdowns' && (
          <div className="card">
            <div className="card-t">
              <span>최근 고장수리 이력</span>
              <Link to="/records?maintenanceType=breakdown_repair" className="text-muted" style={{ fontSize: 11 }}>
                정비 이력에서 전체 보기 →
              </Link>
            </div>
            {recentBreakdowns.length === 0 ? (
              <EmptyState>아직 고장수리 이력이 없습니다.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>설비명</th>
                      <th>날짜</th>
                      <th>증상</th>
                      <th>조치내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBreakdowns.map((r) => (
                      <tr key={r.id}>
                        <td>{r.equipment_name}</td>
                        <td className="mono">{r.record_date}</td>
                        <td>{r.symptom_text || <span className="text-muted">-</span>}</td>
                        <td>{r.action_text || <span className="text-muted">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stale' && (
          <div className="card">
            <div className="card-t">
              <span>정비 안 된 지 오래된 설비</span>
              <small>최근 정비일 기준 오래된 순</small>
            </div>
            {staleEquipment.length === 0 ? (
              <EmptyState>표시할 설비가 없습니다.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>설비명</th>
                      <th>최근 정비일</th>
                      <th>경과일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staleEquipment.map((e) => {
                      const isPulsing =
                        highlightStale &&
                        !acknowledgedStaleIds.has(e.equipment_id) &&
                        daysSince(e.last_record_date) > STALE_ALERT_DAYS;
                      return (
                        <tr
                          key={e.equipment_id}
                          className={isPulsing ? 'row-alert-pulse' : ''}
                          onClick={() => setAcknowledgedStaleIds((prev) => new Set(prev).add(e.equipment_id))}
                        >
                          <td><Link to={`/equipment?id=${e.equipment_id}`}>{e.equipment_name}</Link></td>
                          <td className="mono">{e.last_record_date}</td>
                          <td className="mono">{daysSince(e.last_record_date)}일</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <div className="card">
              <div className="card-t">
                <span>월별 정비 이력 추이</span>
                <small>유형별 건수</small>
              </div>
              {trends.length === 0 ? (
                <EmptyState>아직 표시할 정비 이력이 없습니다.</EmptyState>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {trendYears.map((y) => (
                      <span
                        key={y}
                        className={`chip${y === selectedYear ? ' active' : ''}`}
                        onClick={() => setSelectedYear(y)}
                      >
                        {y}년
                      </span>
                    ))}
                  </div>
                  <div style={{ height: 260 }}>
                    <TrendChart rows={yearTrends} />
                  </div>
                  {yearTrends.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <TrendLegend rows={yearTrends} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="card">
              <div className="card-t">
                <span>설비별 통계</span>
                <small>{equipmentStats.length}개 설비</small>
              </div>
              {equipmentStats.length === 0 ? (
                <EmptyState>아직 표시할 설비 이력이 없습니다.</EmptyState>
              ) : (
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>설비명</th>
                        <th>전체</th>
                        <th>고장수리</th>
                        <th>예방점검</th>
                        <th>기타/미상</th>
                        <th>최근 정비일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentStats.map((e) => (
                        <tr key={e.equipment_id}>
                          <td>
                            <Link to={`/equipment?id=${e.equipment_id}`}>{e.equipment_name}</Link>
                          </td>
                          <td className="mono">{e.total}</td>
                          <td className="mono">{e.breakdown_count}</td>
                          <td className="mono">{e.inspection_count}</td>
                          <td className="mono">{e.other_count + e.unknown_count}</td>
                          <td className="mono">{e.last_record_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
