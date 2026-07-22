import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as equipmentApi from '../api/equipment.api';
import * as dashboardApi from '../api/dashboard.api';
import { EmptyState } from '../components/EmptyState';
import { MaintenanceTypeBadge } from '../components/Badge';

const CATEGORY_GROUPS = [
  { type: 'breakdown_repair', label: '고장수리' },
  { type: 'preventive_inspection', label: '예방점검' },
  { type: 'other', label: '기타' },
  { type: 'unknown', label: '미상' },
];

function RecordTable({ rows, showType = false }) {
  return (
    <div className="table-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>날짜</th>
            {showType && <th>유형</th>}
            <th>증상</th>
            <th>조치내용</th>
            <th>부품</th>
            <th>등록업체</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">{r.record_date}</td>
              {showType && <td><MaintenanceTypeBadge type={r.maintenance_type} /></td>}
              <td>{r.symptom_text || <span className="text-muted">-</span>}</td>
              <td>{r.action_text || <span className="text-muted">-</span>}</td>
              <td>{r.part_text || <span className="text-muted">-</span>}</td>
              <td>{r.company_source || <span className="text-muted">-</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EquipmentHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState(searchParams.get('name') || '');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [grouped, setGrouped] = useState(true);
  const [equipmentList, setEquipmentList] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .getEquipmentStats()
      .then(setEquipmentList)
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  async function loadHistory(equipmentName) {
    if (!equipmentName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await equipmentApi.getHistory(equipmentName.trim());
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get('name');
    if (initial) loadHistory(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    setSearchParams(name.trim() ? { name: name.trim() } : {});
    loadHistory(name);
  }

  function selectEquipment(equipmentName) {
    setName(equipmentName);
    setSearchParams({ name: equipmentName });
    loadHistory(equipmentName);
  }

  return (
    <div>
      <form className="filter-row" onSubmit={handleSearch}>
        <input
          placeholder="설비명을 입력하세요 (예: 3호기 펌프)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
          조회
        </button>
        {history && (
          <span className={`chip${grouped ? ' active' : ''}`} onClick={() => setGrouped((v) => !v)}>
            카테고리별 그룹핑
          </span>
        )}
      </form>

      {loading && <div className="text-muted">불러오는 중...</div>}
      {error && <EmptyState>불러오지 못했습니다: {error}</EmptyState>}

      {!history && !loading && (
        <div className="card">
          <div className="card-t">
            <span>설비 목록</span>
            <small>{equipmentList.length}개</small>
          </div>
          {listLoading ? (
            <div className="text-muted">불러오는 중...</div>
          ) : equipmentList.length === 0 ? (
            <EmptyState>등록된 정비 이력이 없습니다.</EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>설비명</th>
                    <th>전체</th>
                    <th>고장수리</th>
                    <th>예방점검</th>
                    <th>최근 정비일</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.map((e) => (
                    <tr key={e.equipment_name}>
                      <td>{e.equipment_name}</td>
                      <td className="mono">{e.total}</td>
                      <td className="mono">{e.breakdown_count}</td>
                      <td className="mono">{e.inspection_count}</td>
                      <td className="mono">{e.last_record_date}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => selectEquipment(e.equipment_name)}>
                          이력 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {history && !loading && (
        <div className="card">
          <div className="card-t">
            <span>{name} 정비 이력</span>
            <small>{history.length}건</small>
          </div>
          {history.length === 0 ? (
            <EmptyState>해당 설비명의 이력이 없습니다. 정확한 설비명인지 확인하세요.</EmptyState>
          ) : grouped ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {CATEGORY_GROUPS.map(({ type, label }) => {
                const rows = history.filter((r) => r.maintenance_type === type);
                if (rows.length === 0) return null;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <MaintenanceTypeBadge type={type} />
                      <span className="text-muted" style={{ fontSize: 11.5 }}>{label} {rows.length}건</span>
                    </div>
                    <RecordTable rows={rows} />
                  </div>
                );
              })}
            </div>
          ) : (
            <RecordTable rows={history} showType />
          )}
        </div>
      )}
    </div>
  );
}
