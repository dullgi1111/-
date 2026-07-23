import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as dashboardApi from '../api/dashboard.api';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { MatchTypeBadge } from '../components/Badge';
import { TrendChart, TrendLegend } from '../components/TrendChart';
import { LoadingHint } from '../components/LoadingHint';

function DashPanel({ title, sub, linkTo, linkLabel, footer, fitContent, children }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, marginBottom: 0 }}>
      <div className="card-t" style={{ flexShrink: 0 }}>
        <span>{title}</span>
        {linkTo ? (
          <Link to={linkTo} className="text-muted" style={{ fontSize: 11 }}>
            {linkLabel} →
          </Link>
        ) : (
          <small>{sub}</small>
        )}
      </div>
      <div
        style={
          fitContent
            ? { flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }
            : { flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }
        }
      >
        {children}
      </div>
      {footer && <div style={{ flexShrink: 0, paddingTop: 10 }}>{footer}</div>}
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [discoveries, setDiscoveries] = useState([]);
  const [merges, setMerges] = useState([]);
  const [trends, setTrends] = useState([]);
  const [equipmentStats, setEquipmentStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);

  useEffect(() => {
    Promise.all([
      dashboardApi.getSummary(),
      dashboardApi.getRecentDiscoveries(8),
      dashboardApi.getRecentMerges(8),
      dashboardApi.getTrends(),
      dashboardApi.getEquipmentStats(),
    ])
      .then(([summaryData, discoveriesData, mergesData, trendsData, equipmentStatsData]) => {
        setSummary(summaryData);
        setDiscoveries(discoveriesData);
        setMerges(mergesData);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="stat-row" style={{ flexShrink: 0, marginBottom: 14 }}>
        <StatCard label="전체 정비 이력" value={summary.totalRecords} color="var(--accent)" />
        <StatCard label="고장수리" value={byType.breakdown_repair || 0} color="var(--danger)" />
        <StatCard label="예방점검" value={byType.preventive_inspection || 0} color="var(--ok)" />
        <StatCard label="검토 필요 용어" value={summary.needsReviewTerms} sub="사전에서 확인" color="var(--warn)" />
        <StatCard label="이번 주 업로드 배치" value={summary.batchesThisWeek} color="var(--purple)" />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
        <DashPanel title="월별 정비 이력 추이" sub="유형별 건수" footer={yearTrends.length > 0 ? <TrendLegend rows={yearTrends} /> : null} fitContent>
          {trends.length === 0 ? (
            <EmptyState>아직 표시할 정비 이력이 없습니다.</EmptyState>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0 }}>
              <div style={{ flexShrink: 0, display: 'flex', gap: 6, marginBottom: 8 }}>
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
              <div style={{ flex: 1, minHeight: 0 }}>
                <TrendChart rows={yearTrends} />
              </div>
            </div>
          )}
        </DashPanel>

        <DashPanel title="설비별 통계" sub={`${equipmentStats.length}개 설비`}>
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
                    <tr key={e.equipment_name}>
                      <td>
                        <Link to={`/equipment?name=${encodeURIComponent(e.equipment_name)}`}>{e.equipment_name}</Link>
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
        </DashPanel>

        <DashPanel title="최근 신규 발견 용어" linkTo="/dictionary?needsReview=true" linkLabel="사전에서 전체 보기">
          {discoveries.length === 0 ? (
            <EmptyState>아직 신규 발견된 용어가 없습니다.</EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>용어</th>
                    <th>발견 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {discoveries.map((t) => (
                    <tr key={t.id}>
                      <td>{t.term_type}</td>
                      <td>{t.canonical_text}</td>
                      <td className="mono">{new Date(t.created_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashPanel>

        <DashPanel title="최근 자동 병합" linkTo="/audit" linkLabel="전체 로그 보기">
          {merges.length === 0 ? (
            <EmptyState>아직 자동 병합된 항목이 없습니다.</EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>표현</th>
                    <th>유사도</th>
                    <th>구분</th>
                    <th>병합 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {merges.map((m) => (
                    <tr key={m.id}>
                      <td>{m.alias_text}</td>
                      <td className="mono">{Number(m.similarity_score).toFixed(2)}</td>
                      <td><MatchTypeBadge type="alias_auto_merge" /></td>
                      <td className="mono">{new Date(m.merged_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashPanel>
      </div>
    </div>
  );
}
