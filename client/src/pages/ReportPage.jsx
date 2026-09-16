import { useEffect, useState } from 'react';
import * as dashboardApi from '../api/dashboard.api';
import * as equipmentApi from '../api/equipment.api';
import * as recordsApi from '../api/records.api';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { useToast } from '../components/ToastProvider';
import {
  exportReportExcel,
  exportReportWord,
  exportReportPdf,
  DETAIL_FIELD_DEFS,
  formatDetailField,
  GROUP_BY_DEFS,
  groupByLabel,
  formatGroupValue,
  buildScopeLine,
} from '../utils/reportExport';

const DETAIL_ROW_LIMIT = 1000;

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

  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipmentSuggestions, setEquipmentSuggestions] = useState([]);
  const [selectedFields, setSelectedFields] = useState(
    Object.fromEntries(DETAIL_FIELD_DEFS.map((f) => [f.key, f.defaultOn]))
  );
  const [detailRecords, setDetailRecords] = useState(null);
  const [detailTruncated, setDetailTruncated] = useState(false);
  const [groupBy, setGroupBy] = useState('equipment_name');
  const [selectedLines, setSelectedLines] = useState([]);
  const [lineQuery, setLineQuery] = useState('');
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);
  const [equipmentLines, setEquipmentLines] = useState([]);

  const years = currentYearOptions();

  useEffect(() => {
    dashboardApi.getEquipmentLines().then(setEquipmentLines).catch(() => {});
  }, []);

  useEffect(() => {
    const q = equipmentQuery.trim();
    if (!q) {
      setEquipmentSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      equipmentApi
        .listEquipment({ search: q, limit: 8 })
        .then((rows) => {
          if (!cancelled) setEquipmentSuggestions(rows.filter((r) => !selectedEquipment.some((s) => s.id === r.id)));
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentQuery]);

  function addEquipment(eq) {
    setSelectedEquipment((prev) => [...prev, { id: eq.id, equipment_name: eq.equipment_name }]);
    setEquipmentQuery('');
    setEquipmentSuggestions([]);
  }

  function removeEquipment(id) {
    setSelectedEquipment((prev) => prev.filter((e) => e.id !== id));
  }

  function addLine(line) {
    setSelectedLines((prev) => (prev.includes(line) ? prev : [...prev, line]));
    setLineQuery('');
  }

  function removeLine(line) {
    setSelectedLines((prev) => prev.filter((l) => l !== line));
  }

  const lineSuggestions = lineDropdownOpen
    ? equipmentLines.filter(
        (l) => l.line.toLowerCase().includes(lineQuery.trim().toLowerCase()) && !selectedLines.includes(l.line)
      )
    : [];

  function toggleField(key) {
    setSelectedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGroupByChange(newGroupBy) {
    setGroupBy(newGroupBy);
    if (!report) return;
    try {
      const updated = await dashboardApi.getReport(report.dateFrom, report.dateTo, newGroupBy);
      setReport(updated);
    } catch (err) {
      toast.error(err.message);
    }
  }

  function currentRange() {
    return mode === 'month' ? monthRange(year, month) : quarterRange(year, quarter);
  }

  function handleGenerate(e) {
    e.preventDefault();
    const range = currentRange();
    setLoading(true);
    setError(null);
    setDetailRecords(null);
    setDetailTruncated(false);
    Promise.all([
      dashboardApi.getReport(range.dateFrom, range.dateTo, groupBy),
      recordsApi.listRecords({
        equipmentIds: selectedEquipment.length > 0 ? selectedEquipment.map((e) => e.id).join(',') : undefined,
        equipmentLines: selectedLines.length > 0 ? selectedLines.join(',') : undefined,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        limit: DETAIL_ROW_LIMIT,
      }),
    ])
      .then(([reportData, records]) => {
        setReport(reportData);
        setDetailRecords(records.slice().reverse());
        setDetailTruncated(records.length >= DETAIL_ROW_LIMIT);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const byType = Object.fromEntries((report?.byType || []).map((r) => [r.maintenance_type, r.count]));
  const activeFieldKeys = DETAIL_FIELD_DEFS.filter((f) => selectedFields[f.key]).map((f) => f.key);

  async function handleExport() {
    if (!report) return;
    setExporting(true);
    try {
      const detail = {
        records: detailRecords || [],
        fieldKeys: activeFieldKeys,
        truncated: detailTruncated,
        equipmentFilter: selectedEquipment,
        lineFilters: selectedLines,
      };
      if (format === 'excel') {
        exportReportExcel(report, byType, detail);
      } else if (format === 'word') {
        await exportReportWord(report, byType, detail);
      } else {
        await exportReportPdf(report, byType, detail);
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

      <div className="card no-print">
        <div className="card-t"><span>상세 내역 옵션</span></div>

        <div className="field" style={{ position: 'relative' }}>
          <label>포함할 설비 (선택하지 않으면 전체 설비)</label>
          <input
            placeholder="설비명 검색 후 선택"
            value={equipmentQuery}
            onChange={(e) => setEquipmentQuery(e.target.value)}
          />
          {equipmentSuggestions.length > 0 && (
            <div
              className="card"
              style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4, padding: 6 }}
            >
              {equipmentSuggestions.map((eq) => (
                <div
                  key={eq.id}
                  className="chip"
                  style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => addEquipment(eq)}
                >
                  {eq.equipment_name}
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedEquipment.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {selectedEquipment.map((eq) => (
              <span key={eq.id} className="chip active" onClick={() => removeEquipment(eq.id)}>
                {eq.equipment_name} ✕
              </span>
            ))}
          </div>
        )}

        <div className="field" style={{ position: 'relative' }}>
          <label>설비라인 (선택하지 않으면 전체, 여러 개 선택 가능)</label>
          <input
            placeholder="클릭하면 전체 목록, 입력하면 검색"
            value={lineQuery}
            onFocus={() => setLineDropdownOpen(true)}
            onBlur={() => setLineDropdownOpen(false)}
            onChange={(e) => setLineQuery(e.target.value)}
          />
          {lineSuggestions.length > 0 && (
            <div
              className="card"
              style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4, padding: 6, maxHeight: 260, overflowY: 'auto' }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {lineSuggestions.map((l) => (
                <div
                  key={l.line}
                  className="chip"
                  style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => addLine(l.line)}
                >
                  {l.line} ({l.count})
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedLines.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {selectedLines.map((l) => (
              <span key={l} className="chip active" onClick={() => removeLine(l)}>
                {l} ✕
              </span>
            ))}
          </div>
        )}

        <div className="field">
          <label>포함할 항목</label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {DETAIL_FIELD_DEFS.map((f) => (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!selectedFields[f.key]} onChange={() => toggleField(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </div>

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
              <span>{groupByLabel(report.groupBy)} TOP 10</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <small className="no-print">집계 기준</small>
                <select
                  className="no-print"
                  value={groupBy}
                  onChange={(e) => handleGroupByChange(e.target.value)}
                  style={{ fontSize: 12.5, padding: '3px 8px' }}
                >
                  {GROUP_BY_DEFS.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {report.topGroup.length === 0 ? (
              <EmptyState>이 기간에 해당하는 이력이 없습니다.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{groupByLabel(report.groupBy)}</th>
                      <th>건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topGroup.map((g) => (
                      <tr key={g.group_value}>
                        <td>{formatGroupValue(report.groupBy, g.group_value)}</td>
                        <td className="mono">{g.count}</td>
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

          <div className="card">
            <div className="card-t">
              <span>정비 상세 내역</span>
              <small>
                {buildScopeLine({ equipmentFilter: selectedEquipment, lineFilters: selectedLines })} ·{' '}
                {detailRecords?.length || 0}건{detailTruncated ? ` (최대 ${DETAIL_ROW_LIMIT}건까지 표시, 초과분은 잘림)` : ''}
              </small>
            </div>
            {!detailRecords || detailRecords.length === 0 ? (
              <EmptyState>조건에 맞는 정비 상세 내역이 없습니다.</EmptyState>
            ) : activeFieldKeys.length === 0 ? (
              <EmptyState>"상세 내역 옵션"에서 포함할 항목을 하나 이상 선택하세요.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>설비명</th>
                      {activeFieldKeys.map((key) => (
                        <th key={key}>{DETAIL_FIELD_DEFS.find((f) => f.key === key)?.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRecords.map((r) => (
                      <tr key={r.id}>
                        <td>{r.equipment_name}</td>
                        {activeFieldKeys.map((key) => (
                          <td key={key}>{formatDetailField(key, r)}</td>
                        ))}
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
