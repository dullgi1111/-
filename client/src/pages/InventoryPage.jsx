import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as inventoryApi from '../api/inventory.api';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { useToast } from '../components/ToastProvider';

export function InventoryPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('lowStockOnly') === 'true');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const highlight = searchParams.get('highlight');
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  useEffect(() => {
    if (highlight) setAcknowledgedIds(new Set());
  }, [highlight]);

  function load() {
    setLoading(true);
    inventoryApi
      .listInventory({ lowStockOnly: lowStockOnly ? 'true' : undefined })
      .then((data) => {
        setRows(data);
        setDrafts(Object.fromEntries(data.map((r) => [
          r.canonical_term_id,
          { stockQuantity: r.stock_quantity, unit: r.unit, minStockAlert: r.min_stock_alert ?? '' },
        ])));
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowStockOnly]);

  function updateDraft(termId, field, value) {
    setDrafts((prev) => ({ ...prev, [termId]: { ...prev[termId], [field]: value } }));
  }

  async function handleSave(termId) {
    const draft = drafts[termId];
    setSavingId(termId);
    try {
      await inventoryApi.updateInventory(termId, {
        stockQuantity: Number(draft.stockQuantity) || 0,
        unit: draft.unit || '개',
        minStockAlert: draft.minStockAlert === '' ? null : Number(draft.minStockAlert),
      });
      toast.success('재고를 저장했습니다');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  }

  const lowStockCount = rows.filter((r) => r.min_stock_alert !== null && r.stock_quantity <= r.min_stock_alert).length;

  return (
    <div>
      <div className="filter-row">
        <span className={`chip${lowStockOnly ? ' active' : ''}`} onClick={() => setLowStockOnly((v) => !v)}>
          재고 부족만
        </span>
        {!lowStockOnly && lowStockCount > 0 && (
          <Badge variant="danger">재고 부족 {lowStockCount}건</Badge>
        )}
      </div>

      <div className="card">
        <div className="card-t">
          <span>수리부품 재고</span>
          <small>{rows.length}개 부품</small>
        </div>
        {loading ? (
          <div className="text-muted">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <EmptyState>조건에 맞는 부품이 없습니다.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>부품명</th>
                  <th>사용 횟수</th>
                  <th>현재 수량</th>
                  <th>단위</th>
                  <th>재주문 기준</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const draft = drafts[r.canonical_term_id] || {};
                  const isLow = r.min_stock_alert !== null && r.stock_quantity <= r.min_stock_alert;
                  const isPulsing = highlight && isLow && !acknowledgedIds.has(r.canonical_term_id);
                  return (
                    <tr
                      key={r.canonical_term_id}
                      className={isPulsing ? 'row-alert-pulse' : ''}
                      onClick={() => setAcknowledgedIds((prev) => new Set(prev).add(r.canonical_term_id))}
                    >
                      <td>{r.canonical_text}</td>
                      <td className="mono">{r.occurrence_count}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          style={{ width: 80 }}
                          value={draft.stockQuantity ?? 0}
                          onChange={(e) => updateDraft(r.canonical_term_id, 'stockQuantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          style={{ width: 60 }}
                          value={draft.unit ?? '개'}
                          onChange={(e) => updateDraft(r.canonical_term_id, 'unit', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          style={{ width: 80 }}
                          placeholder="선택"
                          value={draft.minStockAlert ?? ''}
                          onChange={(e) => updateDraft(r.canonical_term_id, 'minStockAlert', e.target.value)}
                        />
                      </td>
                      <td>{isLow ? <Badge variant="danger">부족</Badge> : <Badge variant="ok">정상</Badge>}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={savingId === r.canonical_term_id}
                          onClick={() => handleSave(r.canonical_term_id)}
                        >
                          저장
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
    </div>
  );
}
