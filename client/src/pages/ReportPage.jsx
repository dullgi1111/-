import { useState } from 'react';
import * as dashboardApi from '../api/dashboard.api';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { useToast } from '../components/ToastProvider';
import { exportReportExcel, exportReportWord, exportReportPdf } from '../utils/reportExport';

const QUARTER_LABELS = {
  1: '1분기 (1~3월)',
  2: '2분기 (4~6월)',
  3: '3분기 (7~9월)',
  4: '4분기 (10~12월)',
};

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthRange(year, month) {
  return {
    dateFrom: `${year}-${pad2(month)}-01`,
    dateTo: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
  };
}

function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    dateFrom: `${year}-${pad2(startMonth)}-01`,
    dateTo: `${year}-${pad2(endMonth)}-${pad2(lastDayOfMonth(year, endMonth))}`,
  };
}

function currentYearOptions() {
  const nowYear = new Date().getFullYear();
  const years = [];
  for (let y = nowYear; y >= nowYear - 5; y--) years.push(y);
  return years;
}

export function ReportPage() {
  const toast = useToast();
  const now = new Date();
  const [mode, setMode] = useState('month'); // 'month' | 'quarter'
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [format, setFormat] = useState('pdf');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const years = currentYearOptions();

  function currentRange() {
    return mode === 'month' ? monthRange(year, month) : quarterRange(year, quarter);
  }

  function handleGenerate(e) {
    e.preventDefault();
    const range = currentRange();
    setLoading(true);
    setError(null);
    dashboardApi
      .getReport(range.dateFrom, range.dateTo)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const byType = Object.fromEntries((report?.byType || []).map((r) => [r.maintenance_type, r.count]));

  async function handleExport() {
    if (!report) return;
    setExporting(true);
    try {
      if (format === 'excel') {
        exportReportExcel(report, byType);
      } else if (format === 'word') {
        await exportReportWord(report, byType);
      } else {
        await exportReportPdf(report, byType);
      }
      toast.success('내보내기가 완료되었습니다');
    } catch (err) {
      toast.error(err.message || '내보내기에 실패했습니다');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <form className="filter-row no-print" onSubmit={handleGenerate}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { value: 'month', label: '월간' },
            { value: 'quarter', label: '분기' },
          ].map((m) => (
            <span key={m.value} className={`chip${mode === m.value ? ' active' : ''}`} onClick={() => setMode(m.value)}>
              {m.label}
            </span>
          ))}
        </div>

        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>

        {mode === 'month' ? (
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        ) : (
          <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>{QUARTER_LABELS[q]}</option>
            ))}
          </select>
        )}

        <button className="btn btn-secondary btn-sm" type="submit">조회</button>

        {report && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" type="button" onClick={handleExport} disabled={exporting}>
              {exporting ? '내보내는 중...' : '내보내기'}
            </button>
          </div>
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
