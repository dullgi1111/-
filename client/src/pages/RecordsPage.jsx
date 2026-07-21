import { useEffect, useState } from 'react';
import * as recordsApi from '../api/records.api';
import { EmptyState } from '../components/EmptyState';
import { MaintenanceTypeBadge, MatchTypeBadge, Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { downloadCsv } from '../utils/csvExport';
import { useToast } from '../components/ToastProvider';

const TYPE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'breakdown_repair', label: '고장수리' },
  { value: 'preventive_inspection', label: '예방점검' },
  { value: 'unknown', label: '미상' },
];

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

const FIELD_TYPE_LABELS = { symptom: '증상', action: '조치', part: '부품' };

const CSV_HEADERS = [
  { key: 'equipment_name', label: '설비명' },
  { key: 'record_date', label: '날짜' },
  { key: 'maintenance_type', label: '유형' },
  { key: 'symptom_text', label: '증상' },
  { key: 'action_text', label: '조치내용' },
  { key: 'part_text', label: '부품명' },
  { key: 'company_source', label: '등록업체' },
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
  const [equipment, setEquipment] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('');
  const [month, setMonth] = useState('');
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState(null);

  function load() {
    setLoading(true);
    recordsApi
      .listRecords({ equipment, maintenanceType, month, limit: 100 })
      .then(setRecords)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenanceType, month]);

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
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {TYPE_FILTERS.map((f) => (
            <span
              key={f.value}
              className={`chip${maintenanceType === f.value ? ' active' : ''}`}
              onClick={() => setMaintenanceType(f.value)}
            >
              {f.label}
            </span>
          ))}
        </div>
      </form>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {MONTH_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`chip${month === f.value ? ' active' : ''}`}
            onClick={() => setMonth(f.value)}
          >
            {f.label}
          </span>
        ))}
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
                  <th>날짜</th>
                  <th>유형</th>
                  <th>증상</th>
                  <th>조치내용</th>
                  <th>등록업체</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.equipment_name}</td>
                    <td className="mono">{r.record_date}</td>
                    <td><MaintenanceTypeBadge type={r.maintenance_type} /></td>
                    <td>{r.symptom_text || <span className="text-muted">-</span>}</td>
                    <td>{r.action_text || <span className="text-muted">-</span>}</td>
                    <td>{r.company_source || <span className="text-muted">-</span>}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleView(r.id)}>
                        자세히
                      </button>
                    </td>
                  </tr>
                ))}
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
                  <div className="stat-label">날짜</div>
                  <div className="mono">{viewData.record.record_date}</div>
                </div>
                <div>
                  <div className="stat-label">유형</div>
                  <div><MaintenanceTypeBadge type={viewData.record.maintenance_type} /></div>
                </div>
                <div>
                  <div className="stat-label">등록업체</div>
                  <div>{viewData.record.company_source || <span className="text-muted">-</span>}</div>
                </div>
              </div>

              <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div className="stat-label">증상</div>
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

              <div className="card-t" style={{ marginTop: 4 }}>
                <span>인식된 표준 용어</span>
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
