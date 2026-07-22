import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as equipmentApi from '../api/equipment.api';
import * as dashboardApi from '../api/dashboard.api';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';

const FIELD_LABELS = { symptom: '자주 발생하는 증상', action: '자주 수행된 조치', part: '자주 사용된 부품' };

function TopTermList({ items }) {
  if (!items || items.length === 0) return <div className="text-muted" style={{ fontSize: 12.5 }}>데이터 없음</div>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.text}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span>{item.text}</span>
            <span className="mono text-muted">{item.count}</span>
          </div>
          <div style={{ background: 'var(--border2)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductInfoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [equipmentList, setEquipmentList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [name, setName] = useState(searchParams.get('name') || '');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    dashboardApi
      .getEquipmentStats()
      .then(setEquipmentList)
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  async function loadDetail(equipmentName) {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await equipmentApi.getDetail(equipmentName);
      setDetail(data);
    } catch (err) {
      setError(err.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get('name');
    if (initial) loadDetail(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectEquipment(equipmentName) {
    setName(equipmentName);
    setSearchParams({ name: equipmentName });
    loadDetail(equipmentName);
  }

  function backToList() {
    setDetail(null);
    setError(null);
    setSearchParams({});
  }

  if (detail || detailLoading || error) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={backToList} style={{ marginBottom: 14 }}>
          ← 제품 목록으로
        </button>

        {detailLoading && <div className="text-muted">불러오는 중...</div>}
        {error && <EmptyState>불러오지 못했습니다: {error}</EmptyState>}

        {detail && (
          <>
            <div className="card">
              <div className="card-t">
                <span>{detail.equipmentName}</span>
                <Link to={`/equipment?name=${encodeURIComponent(detail.equipmentName)}`} className="text-muted" style={{ fontSize: 11 }}>
                  전체 이력 보기 →
                </Link>
              </div>
              <div className="stat-row" style={{ marginBottom: 0 }}>
                <div className="stat">
                  <div className="stat-label">전체 정비 이력</div>
                  <div className="stat-num">{detail.total}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">고장수리</div>
                  <div className="stat-num" style={{ color: 'var(--danger)' }}>{detail.breakdown_count}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">예방점검</div>
                  <div className="stat-num" style={{ color: 'var(--ok)' }}>{detail.inspection_count}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">등록 업체</div>
                  <div className="stat-num">{detail.companies?.length || 0}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 12.5, color: 'var(--ink3)' }}>
                <span>최초 등록일: <span className="mono" style={{ color: 'var(--ink2)' }}>{detail.first_record_date}</span></span>
                <span>최근 정비일: <span className="mono" style={{ color: 'var(--ink2)' }}>{detail.last_record_date}</span></span>
              </div>
              {detail.companies?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {detail.companies.map((c) => (
                    <Badge key={c} variant="neutral">{c}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {['symptom', 'action', 'part'].map((field) => (
                <div className="card" key={field}>
                  <div className="card-t">
                    <span>{FIELD_LABELS[field]}</span>
                    <small>TOP 5</small>
                  </div>
                  <TopTermList items={detail.topTerms?.[field]} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-t">
        <span>제품 목록</span>
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
                <th>전체 이력</th>
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
                      제품 정보 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
