import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as dashboardApi from '../api/dashboard.api';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { MatchTypeBadge } from '../components/Badge';

export function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [discoveries, setDiscoveries] = useState([]);
  const [merges, setMerges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([dashboardApi.getSummary(), dashboardApi.getRecentDiscoveries(8), dashboardApi.getRecentMerges(8)])
      .then(([summaryData, discoveriesData, mergesData]) => {
        setSummary(summaryData);
        setDiscoveries(discoveriesData);
        setMerges(mergesData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted">불러오는 중...</div>;
  if (error) return <EmptyState>데이터를 불러오지 못했습니다: {error}</EmptyState>;

  const byType = Object.fromEntries((summary.byType || []).map((r) => [r.maintenance_type, r.count]));

  return (
    <div>
      <div className="stat-row">
        <StatCard label="전체 정비 이력" value={summary.totalRecords} color="var(--accent)" />
        <StatCard label="고장수리" value={byType.breakdown_repair || 0} color="var(--danger)" />
        <StatCard label="예방점검" value={byType.preventive_inspection || 0} color="var(--ok)" />
        <StatCard label="검토 필요 용어" value={summary.needsReviewTerms} sub="사전에서 확인" color="var(--warn)" />
        <StatCard label="이번 주 업로드 배치" value={summary.batchesThisWeek} color="var(--purple)" />
      </div>

      <div className="card">
        <div className="card-t">
          <span>최근 신규 발견 용어</span>
          <Link to="/dictionary?needsReview=true" className="text-muted" style={{ fontSize: 11 }}>
            사전에서 전체 보기 →
          </Link>
        </div>
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
      </div>

      <div className="card">
        <div className="card-t">
          <span>최근 자동 병합</span>
          <Link to="/audit" className="text-muted" style={{ fontSize: 11 }}>
            전체 로그 보기 →
          </Link>
        </div>
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
      </div>
    </div>
  );
}
