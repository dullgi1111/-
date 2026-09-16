import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as recordsApi from '../api/records.api';
import * as dashboardApi from '../api/dashboard.api';
import { EmptyState } from '../components/EmptyState';
import { MaintenanceTypeBadge, MatchTypeBadge, Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { downloadCsv } from '../utils/csvExport';
import { useToast } from '../components/ToastProvider';
import { HelpButton, HelpSection } from '../components/HelpButton';

const MONTH_FILTERS = [
  { value: '', label: '전체' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
];

const MAINTENANCE_TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

const TYPE_CONFIRM_OPTIONS = [
  { value: 'breakdown_repair', label: '고장수리' },
  { value: 'preventive_inspection', label: '예방점검' },
  { value: 'other', label: '기타' },
  { value: 'unknown', label: '미상' },
];

const FIELD_TYPE_LABELS = { symptom: '증상', action: '조치', part: '부품' };

const CSV_HEADERS = [
  { key: 'equipment_name', label: '설비명' },
  { key: 'record_date', label: '작업일자' },
  { key: 'work_name', label: '작업명' },
  { key: 'work_content', label: '작업내용' },
  { key: 'symptom_text', label: '현상' },
  { key: 'work_team', label: '수행반' },
];

function csvAccessor(row, key) {
  if (key === 'maintenance_type') return MAINTENANCE_TYPE_LABELS[row.maintenance_type] || row.maintenance_type;
  return row[key];
}

export function RecordsPage() {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const [equipment, setEquipment] = useState('');
  const [maintenanceType, setMaintenanceType] = useState(searchParams.get('maintenanceType') || '');
  const [month, setMonth] = useState('');
  const [equipmentLine, setEquipmentLine] = useState('');
  const [equipmentLines, setEquipmentLines] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [symptomOptions, setSymptomOptions] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [teamOptions, setTeamOptions] = useState([]);
  const [dateRange, setDateRange] = useState({
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  });
  const [needsTypeReview, setNeedsTypeReview] = useState(searchParams.get('needsTypeReview') === 'true');
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState(null);
  const [correctingType, setCorrectingType] = useState(false);
  const highlight = searchParams.get('highlight');
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  useEffect(() => {
    if (highlight) setAcknowledgedIds(new Set());
  }, [highlight]);

  useEffect(() => {
    dashboardApi.getEquipmentLines().then(setEquipmentLines).catch(() => {});
    dashboardApi.getSymptomOptions().then(setSymptomOptions).catch(() => {});
    dashboardApi.getWorkTeamOptions().then(setTeamOptions).catch(() => {});
  }, []);

  function toggleSymptom(value) {
    setSelectedSymptoms((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function toggleTeam(value) {
    setSelectedTeams((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  useEffect(() => {
    const recordId = searchParams.get('recordId');
    if (recordId) handleView(recordId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    recordsApi
      .listRecords({
        equipment,
        maintenanceType,
        month,
        equipmentLines: equipmentLine || undefined,
        symptomTexts: selectedSymptoms.length > 0 ? selectedSymptoms.join(',') : undefined,
        workTeams: selectedTeams.length > 0 ? selectedTeams.join(',') : undefined,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        needsTypeReview: needsTypeReview ? 'true' : undefined,
        limit: 100,
      })
      .then(setRecords)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenanceType, month, equipmentLine, selectedSymptoms, selectedTeams, dateRange, needsTypeReview]);

  function clearDateRange() {
    setDateRange({ dateFrom: '', dateTo: '' });
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    load();
  }

  async function handleView(id) {
    setViewLoading(true);
    setViewError(null);
    try {
      const data = await recordsApi.getRecord(id);
      setViewData(data);
    } catch (err) {
      setViewError(err.message);
    } finally {
      setViewLoading(false);
    }
  }

  async function handleConfirmType(maintenanceType) {
    setCorrectingType(true);
    try {
      const updated = await recordsApi.confirmType(viewData.record.id, maintenanceType);
      setViewData((prev) => ({ ...prev, record: updated }));
      toast.success('분류를 확인했습니다');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCorrectingType(false);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('정비 이력 전체를 삭제할까요? (현재 필터와 상관없이 등록된 모든 정비 이력이 삭제됩니다) 목록에서 모두 사라지며 되돌릴 수 없습니다.')) return;
    if (!window.confirm('정말로 전체 삭제하시겠습니까? 다시 한번 확인해주세요.')) return;
    try {
      const result = await recordsApi.removeAllRecords();
      toast.success(`${result.deletedCount}건 삭제했습니다`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <form className="filter-row" onSubmit={handleSearchSubmit}>
        <input placeholder="설비명 검색" value={equipment} onChange={(e) => setEquipment(e.target.value)} style={{ maxWidth: 220 }} />
        <button className="btn btn-secondary btn-sm" type="submit">검색</button>
      </form>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <span className="text-muted" style={{ fontSize: 11.5, marginRight: 2 }}>현상</span>
        {symptomOptions.map((o) => (
          <span
            key={o.symptom_text}
            className={`chip${selectedSymptoms.includes(o.symptom_text) ? ' active' : ''}`}
            onClick={() => toggleSymptom(o.symptom_text)}
          >
            {o.symptom_text}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span className="text-muted" style={{ fontSize: 11.5, marginRight: 2 }}>수행반</span>
        {teamOptions.map((o) => (
          <span
            key={o.work_team}
            className={`chip${selectedTeams.includes(o.work_team) ? ' active' : ''}`}
            onClick={() => toggleTeam(o.work_team)}
          >
            {o.work_team}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {MONTH_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`chip${month === f.value ? ' active' : ''}`}
            onClick={() => setMonth(f.value)}
          >
            {f.label}
          </span>
        ))}
        <select
          value={equipmentLine}
          onChange={(e) => setEquipmentLine(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="">설비라인 전체</option>
          {equipmentLines.map((l) => (
            <option key={l.line} value={l.line}>{l.line} ({l.count})</option>
          ))}
        </select>
        <span
          className={`chip${needsTypeReview ? ' active' : ''}`}
          style={{ marginLeft: 8 }}
          onClick={() => setNeedsTypeReview((v) => !v)}
        >
          분류 검토 필요
        </span>
        {dateRange.dateFrom && (
          <span className="chip active" style={{ marginLeft: 8 }} onClick={clearDateRange}>
            기간: {dateRange.dateFrom} ~ {dateRange.dateTo} ✕
          </span>
        )}
      </div>

      <div className="card">
        <div className="card-t">
          <span>정비 이력 목록</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <small>{records.length}건</small>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCsv('정비이력.csv', CSV_HEADERS, records, csvAccessor)}
              disabled={records.length === 0}
            >
              내보내기
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteAll} disabled={records.length === 0}>
              전체 삭제
            </button>
          </div>
        </div>
        {loading && <div className="text-muted">불러오는 중...</div>}
        {error && <EmptyState>불러오지 못했습니다: {error}</EmptyState>}
        {!loading && !error && records.length === 0 && <EmptyState>조건에 맞는 정비 이력이 없습니다.</EmptyState>}
        {!loading && !error && records.length > 0 && (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>설비명</th>
                  <th>라인</th>
                  <th>작업일자</th>
                  <th>작업명</th>
                  <th>작업내용</th>
                  <th>현상</th>
                  <th>수행반</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const isPulsing = highlight && !r.type_confirmed && !acknowledgedIds.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={isPulsing ? 'row-alert-pulse' : ''}
                      onClick={() => setAcknowledgedIds((prev) => new Set(prev).add(r.id))}
                    >
                      <td>{r.equipment_name}</td>
                      <td className="mono">{r.equipment_line || <span className="text-muted">-</span>}</td>
                      <td className="mono">{r.record_date}</td>
                      <td className="ellipsis-cell" title={r.work_name || ''}>{r.work_name || <span className="text-muted">-</span>}</td>
                      <td>{r.work_content || <span className="text-muted">-</span>}</td>
                      <td>{r.symptom_text || <span className="text-muted">-</span>}</td>
                      <td>{r.work_team || <span className="text-muted">-</span>}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleView(r.id)}>
                          자세히
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(viewData || viewLoading || viewError) && (
        <Modal onClose={() => { setViewData(null); setViewError(null); }} title="정비 이력 상세" width={620}>
          {viewLoading && <div className="text-muted">불러오는 중...</div>}
          {viewError && <EmptyState>불러오지 못했습니다: {viewError}</EmptyState>}
          {viewData && (
            <>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div>
                  <div className="stat-label">설비명</div>
                  <div style={{ fontWeight: 700 }}>{viewData.record.equipment_name}</div>
                </div>
                <div>
                  <div className="stat-label">작업일자</div>
                  <div className="mono">{viewData.record.record_date}</div>
                </div>
                <div>
                  <div className="stat-label">수행반</div>
                  <div>{viewData.record.work_team || <span className="text-muted">-</span>}</div>
                </div>
                <div>
                  <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>유형</span>
                    {!viewData.record.type_confirmed && (
                      <HelpButton title="'검토 필요'는 무슨 뜻인가요?" width={440}>
                        <HelpSection heading="시스템이 추정한 값이에요">
                          업로드된 원본 데이터에 정비유형이 명시돼 있지 않으면, 시스템이 증상/조치 내용을
                          보고 "고장수리"인지 "예방점검"인지 자동으로 추정합니다. 추정이 틀릴 수 있어서
                          사람이 한 번 확인하기 전까지 "검토 필요"로 표시됩니다.
                        </HelpSection>
                        <HelpSection heading="확인하려면">
                          아래에 뜨는 "고장수리"/"예방점검"/"미상" 버튼 중 실제로 맞는 것을 누르면 확정되고
                          배지가 사라집니다.
                        </HelpSection>
                      </HelpButton>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <MaintenanceTypeBadge type={viewData.record.maintenance_type} />
                    {!viewData.record.type_confirmed && <Badge variant="warn">검토 필요</Badge>}
                  </div>
                </div>
                <div>
                  <div className="stat-label">등록업체</div>
                  <div>{viewData.record.company_source || <span className="text-muted">-</span>}</div>
                </div>
              </div>

              <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div className="stat-label">작업명</div>
                  <div>{viewData.record.work_name || <span className="text-muted">-</span>}</div>
                </div>
                <div>
                  <div className="stat-label">작업내용</div>
                  <div>{viewData.record.work_content || <span className="text-muted">-</span>}</div>
                </div>
                <div>
                  <div className="stat-label">현상</div>
                  <div>{viewData.record.symptom_text || <span className="text-muted">-</span>}</div>
                </div>
                <div>
                  <div className="stat-label">조치내용</div>
                  <div>{viewData.record.action_text || <span className="text-muted">-</span>}</div>
                </div>
                <div>
                  <div className="stat-label">부품명</div>
                  <div>{viewData.record.part_text || <span className="text-muted">-</span>}</div>
                </div>
              </div>

              {!viewData.record.type_confirmed && (
                <div className="hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span>이 유형은 시스템이 자동으로 추정한 값입니다. 맞는지 확인해주세요.</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TYPE_CONFIRM_OPTIONS.map((f) => (
                      <button
                        key={f.value}
                        className="btn btn-secondary btn-sm"
                        disabled={correctingType}
                        onClick={() => handleConfirmType(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="card-t" style={{ marginTop: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  인식된 표준 용어
                  <HelpButton title="매칭 방식이 뭔가요?" width={460}>
                    <HelpSection heading="증상/조치/부품 문구를 표준 용어로 바꾸는 과정">
                      원본 데이터의 문구(예: "베어링마모")를 시스템이 용어 사전과 대조해서 표준 용어로
                      연결한 결과입니다. 이 표에서 매칭 방식 배지로 어떻게 연결됐는지 알 수 있습니다.
                    </HelpSection>
                    <HelpSection heading="정확일치">
                      용어 사전에 등록된 표준 용어/별칭과 글자가 완전히 같아서 바로 연결된 경우입니다.
                    </HelpSection>
                    <HelpSection heading="자동병합">
                      기존 용어와 표현이 비슷해서(유사도 기준 이상) 시스템이 사람 확인 없이 자동으로 같은
                      용어의 별칭으로 합친 경우입니다. 잘못 합쳐졌다면 "자동병합 로그" 화면에서 되돌릴 수
                      있습니다.
                    </HelpSection>
                    <HelpSection heading="신규발견">
                      사전에 없는 새로운 표현이라 이번에 새 용어로 등록된 경우입니다. "검토 필요" 표시가
                      붙으면 용어 사전에서 한 번 확인해주세요.
                    </HelpSection>
                  </HelpButton>
                </span>
                <small>{viewData.links.length}건</small>
              </div>
              {viewData.links.length === 0 ? (
                <EmptyState>연결된 용어가 없습니다.</EmptyState>
              ) : (
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>구분</th>
                        <th>원본 문구</th>
                        <th>표준 용어</th>
                        <th>매칭 방식</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewData.links.map((l) => (
                        <tr key={l.id}>
                          <td>{FIELD_TYPE_LABELS[l.field_type] || l.field_type}</td>
                          <td>{l.raw_phrase}</td>
                          <td>{l.canonical_text || <span className="text-muted">-</span>}</td>
                          <td><MatchTypeBadge type={l.match_type} /></td>
                          <td>{l.needs_review && <Badge variant="warn">검토 필요</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
