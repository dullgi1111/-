import { useState } from 'react';
import * as equipmentApi from '../api/equipment.api';
import { EmptyState } from '../components/EmptyState';
import { MaintenanceTypeBadge } from '../components/Badge';

export function EquipmentHistoryPage() {
  const [name, setName] = useState('');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await equipmentApi.getHistory(name.trim());
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form className="filter-row" onSubmit={handleSearch}>
        <input
          placeholder="설비명을 정확히 입력하세요 (예: 3호기 펌프)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
          조회
        </button>
      </form>

      {loading && <div className="text-muted">불러오는 중...</div>}
      {error && <EmptyState>불러오지 못했습니다: {error}</EmptyState>}

      {history && (
        <div className="card">
          <div className="card-t">
            <span>{name} 정비 이력</span>
            <small>{history.length}건</small>
          </div>
          {history.length === 0 ? (
            <EmptyState>해당 설비명의 이력이 없습니다. 정확한 설비명인지 확인하세요.</EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>유형</th>
                    <th>증상</th>
                    <th>조치내용</th>
                    <th>부품</th>
                    <th>등록업체</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.record_date}</td>
                      <td><MaintenanceTypeBadge type={r.maintenance_type} /></td>
                      <td>{r.symptom_text || <span className="text-muted">-</span>}</td>
                      <td>{r.action_text || <span className="text-muted">-</span>}</td>
                      <td>{r.part_text || <span className="text-muted">-</span>}</td>
                      <td>{r.company_source || <span className="text-muted">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
