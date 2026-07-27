import { useState } from 'react';
import * as dashboardApi from '../api/dashboard.api';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';

const MAINTENANCE_TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  date.setDate(date.getDate() + diff);
  return date;
}

function presetRange(preset) {
  const today = new Date();
  if (preset === 'week') {
    return { dateFrom: toDateStr(startOfWeek(today)), dateTo: toDateStr(today) };
  }
  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { dateFrom: toDateStr(start), dateTo: toDateStr(today) };
  }
  if (preset === 'lastMonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
  }
  return { dateFrom: toDateStr(today), dateTo: toDateStr(today) };
}

const PRESETS = [
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
  { value: 'lastMonth', label: '지난 달' },
];

export function ReportPage() {
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(presetRange('month'));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function load(r) {
    setLoading(true);
    setError(null);
    dashboardApi
      .getReport(r.dateFrom, r.dateTo)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function handlePreset(p) {
    setPreset(p);
    const r = presetRange(p);
    setRange(r);
    load(r);
  }

  function handleRangeChange(field, value) {
    setPreset('custom');
    setRange((prev) => ({ ...prev, [field]: value }));
  }

  function handleGenerate(e) {
    e.preventDefault();
    load(range);
  }

  const byType = Object.fromEntries((report?.byType || []).map((r) => [r.maintenance_type, r.count]));

  return (
    <div>
      <form className="filter-row no-print" onSubmit={handleGenerate}>
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESETS.map((p) => (
            <span key={p.value} className={`chip${preset === p.value ? ' active' : ''}`} onClick={() => handlePreset(p.value)}>
              {p.label}
            </span>
          ))}
        </div>
        <input type="date" value={range.dateFrom} onChange={(e) => handleRangeChange('dateFrom', e.target.value)} />
        <span className="text-muted">~</span>
        <input type="date" value={range.dateTo} onChange={(e) => handleRangeChange('dateTo', e.target.value)} />
        <button className="btn btn-secondary btn-sm" type="submit">조회</button>
        {report && (
          <button className="btn btn-primary btn-sm" type="button" onClick={() => window.print()} style={{ marginLeft: 'auto' }}>
            인쇄 / PDF로 저장
          </button>
        )}
      </form>

      {loading && <div className="text-muted">불러오는 중...</div>}
      {error && <EmptyState>불러오지 못했습니다: {error}</EmptyState>}

      {!report && !loading && !error && (
        <EmptyState>기간을 선택하고 조회 버튼을 눌러주세요.</EmptyState>
      )}

      {report && !loading && (
        <div>
          <div className="card">
            <div className="card-t">
              <span>정비 리포트</span>
              <small className="mono">{report.dateFrom} ~ {report.dateTo}</small>
            </div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <StatCard label="전체 정비 이력" value={report.totalRecords} color="var(--accent)" />
              <StatCard label="고장수리" value={byType.breakdown_repair || 0} color="var(--danger)" />
              <StatCard label="예방점검" value={byType.preventive_inspection || 0} color="var(--ok)" />
              <StatCard label="신규 발견 용어" value={report.newTermsCount} color="var(--warn)" />
              <StatCard label="등록 업체 수" value={report.companyCount} color="var(--purple)" />
            </div>
          </div>

          <div className="card">
            <div className="card-t">
              <span>고장수리 TOP 10 설비</span>
              <small>이 기간 고장/교체가 가장 많았던 설비</small>
            </div>
            {report.topEquipment.length === 0 ? (
              <EmptyState>이 기간에 고장수리 이력이 없습니다.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>설비명</th>
                      <th>고장수리 건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topEquipment.map((e) => (
                      <tr key={e.equipment_id}>
                        <td>{e.equipment_name}</td>
                        <td className="mono">{e.breakdown_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-t">
              <span>자주 사용된 부품 TOP 10</span>
              <small>재고 확인이 필요할 수 있는 부품</small>
            </div>
            {report.topParts.length === 0 ? (
              <EmptyState>이 기간에 사용된 부품 기록이 없습니다.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>부품명</th>
                      <th>사용 횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topParts.map((p) => (
                      <tr key={p.canonical_text}>
                        <td>{p.canonical_text}</td>
                        <td className="mono">{p.count}</td>
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
  );
}
