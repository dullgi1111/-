import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as equipmentApi from '../api/equipment.api';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/ToastProvider';
import { useUndoableForm, handleUndoKeyDown } from '../hooks/useUndoableForm';
import { UndoHint } from '../components/UndoHint';
import { HelpButton, HelpSection } from '../components/HelpButton';

const FIELD_LABELS = { symptom: '자주 발생하는 증상', action: '자주 수행된 조치', part: '자주 사용된 부품' };

const SPEC_FIELDS = [
  { key: 'modelNumber', label: '모델명' },
  { key: 'manufacturer', label: '제조사' },
  { key: 'installDate', label: '설치일', type: 'date' },
  { key: 'location', label: '설치 위치' },
];

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

function emptyForm() {
  return { equipmentName: '', modelNumber: '', manufacturer: '', spec: '', installDate: '', location: '', notes: '' };
}

export function ProductInfoPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [equipmentList, setEquipmentList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(searchParams.get('needsReview') === 'true');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const editFormState = useUndoableForm(emptyForm());
  const { values: editForm, setValue: setEditField, undo: undoEdit, resetAll: resetEditForm, replaceAll: loadEditForm, canUndo: canUndoEdit } = editFormState;
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const createFormState = useUndoableForm(emptyForm());
  const { values: createForm, setValue: setCreateField, undo: undoCreate, resetAll: resetCreateForm, canUndo: canUndoCreate } = createFormState;
  const [creating, setCreating] = useState(false);
  const highlight = searchParams.get('highlight');
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  useEffect(() => {
    if (highlight) setAcknowledgedIds(new Set());
  }, [highlight]);

  function loadList() {
    setListLoading(true);
    equipmentApi
      .listEquipment({ needsReview: needsReviewOnly ? 'true' : undefined, limit: 200 })
      .then(setEquipmentList)
      .catch((err) => toast.error(err.message))
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReviewOnly]);

  async function loadDetail(id) {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await equipmentApi.getDetail(id);
      setDetail(data);
      loadEditForm({
        equipmentName: data.equipment_name || '',
        modelNumber: data.model_number || '',
        manufacturer: data.manufacturer || '',
        spec: data.spec || '',
        installDate: data.install_date || '',
        location: data.location || '',
        notes: data.notes || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get('id');
    if (initial) loadDetail(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectEquipment(id) {
    setSearchParams({ id: String(id) });
    loadDetail(id);
  }

  function backToList() {
    setDetail(null);
    setError(null);
    setSearchParams({});
    loadList();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await equipmentApi.updateEquipment(detail.id, { ...editForm, needsReview: false });
      toast.success('저장했습니다');
      setDetail((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.equipmentName.trim()) return;
    setCreating(true);
    try {
      await equipmentApi.createEquipment(createForm);
      toast.success('제품을 등록했습니다');
      setShowCreate(false);
      resetCreateForm();
      loadList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (detail || detailLoading || error) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={backToList} style={{ marginBottom: 14 }}>
          ← 제품 목록으로
        </button>

        {detailLoading && <div className="text-muted">불러오는 중...</div>}
        {error && <EmptyState>불러오지 못했습니다: {error}</EmptyState>}

        {detail && editForm && (
          <>
            {detail.needs_review && (
              <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  시스템이 정비 이력에서 자동으로 발견한 설비명입니다. 아래 사양 정보를 확인/입력하고 저장하면 확인 완료로 표시됩니다.
                </span>
                <HelpButton title="'확인 필요'는 왜 뜨나요?" width={440}>
                  <HelpSection heading="정비 이력에서 자동으로 찾아낸 설비예요">
                    엑셀 업로드 시 설비명이 처음 보는 이름이면, 시스템이 정비 이력을 처리하면서 자동으로
                    새 설비로 등록합니다. 이때 모델명·제조사 같은 사양 정보는 원본 데이터에 없을 수 있어
                    비어있는 채로 등록되고, "확인 필요" 상태가 됩니다.
                  </HelpSection>
                  <HelpSection heading="확인하려면">
                    아래 사양 정보(모델명/제조사/설치일 등)를 실제 설비 정보에 맞게 채우고 "저장"을
                    누르면 확인 완료로 바뀝니다. 사양 정보가 없다면 비워둔 채 저장만 해도 확인 완료로
                    표시됩니다.
                  </HelpSection>
                </HelpButton>
              </div>
            )}

            <div className="card">
              <div className="card-t">
                <span>{detail.equipment_name}</span>
                <Link to={`/equipment?id=${detail.id}`} className="text-muted" style={{ fontSize: 11 }}>
                  전체 이력 보기 →
                </Link>
              </div>

              <div onKeyDown={(e) => handleUndoKeyDown(e, { undo: undoEdit, resetAll: resetEditForm })}>
                <div className="form-grid">
                  <div className="field">
                    <label>설비명</label>
                    <input value={editForm.equipmentName} onChange={(e) => setEditField('equipmentName', e.target.value)} />
                  </div>
                  {SPEC_FIELDS.map((f) => (
                    <div className="field" key={f.key}>
                      <label>{f.label}</label>
                      <input
                        type={f.type || 'text'}
                        value={editForm[f.key]}
                        onChange={(e) => setEditField(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label>사양</label>
                  <textarea
                    value={editForm.spec}
                    onChange={(e) => setEditField('spec', e.target.value)}
                    placeholder="용량, 전압, 규격 등 자유 입력"
                  />
                </div>
                <div className="field">
                  <label>비고</label>
                  <textarea value={editForm.notes} onChange={(e) => setEditField('notes', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <UndoHint canUndo={canUndoEdit} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-t"><span>정비 현황</span></div>
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
                <span>최초 등록일: <span className="mono" style={{ color: 'var(--ink2)' }}>{detail.first_record_date || '-'}</span></span>
                <span>최근 정비일: <span className="mono" style={{ color: 'var(--ink2)' }}>{detail.last_record_date || '-'}</span></span>
              </div>
              {detail.companies?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {detail.companies.map((c) => <Badge key={c} variant="neutral">{c}</Badge>)}
                </div>
              )}
              {detail.aliases?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="stat-label" style={{ marginBottom: 6 }}>함께 인식된 표기</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {detail.aliases.map((a) => <Badge key={a.id} variant="accent">{a.alias_text}</Badge>)}
                  </div>
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
    <div>
      <div className="filter-row">
        <span className={`chip${needsReviewOnly ? ' active' : ''}`} onClick={() => setNeedsReviewOnly((v) => !v)}>
          확인 필요만
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto' }}>
          + 제품 등록
        </button>
      </div>

      <div className="card">
        <div className="card-t">
          <span>제품 목록</span>
          <small>{equipmentList.length}개</small>
        </div>
        {listLoading ? (
          <div className="text-muted">불러오는 중...</div>
        ) : equipmentList.length === 0 ? (
          <EmptyState>등록된 제품이 없습니다.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>설비명</th>
                  <th>모델명</th>
                  <th>제조사</th>
                  <th>사용 횟수</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {equipmentList.map((e) => {
                  const isPulsing = highlight && e.needs_review && !acknowledgedIds.has(e.id);
                  return (
                    <tr
                      key={e.id}
                      className={isPulsing ? 'row-alert-pulse' : ''}
                      onClick={() => setAcknowledgedIds((prev) => new Set(prev).add(e.id))}
                    >
                      <td>{e.equipment_name}</td>
                      <td>{e.model_number || <span className="text-muted">-</span>}</td>
                      <td>{e.manufacturer || <span className="text-muted">-</span>}</td>
                      <td className="mono">{e.occurrence_count}</td>
                      <td>{e.needs_review ? <Badge variant="warn">확인 필요</Badge> : <Badge variant="ok">확인됨</Badge>}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => selectEquipment(e.id)}>
                          상세 보기
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

      {showCreate && (
        <Modal onClose={() => { setShowCreate(false); resetCreateForm(); }} title="제품 등록" width={480}>
          <form onSubmit={handleCreate} onKeyDown={(e) => handleUndoKeyDown(e, { undo: undoCreate, resetAll: resetCreateForm })}>
            <div className="field">
              <label>설비명 *</label>
              <input
                value={createForm.equipmentName}
                onChange={(e) => setCreateField('equipmentName', e.target.value)}
                required
              />
            </div>
            {SPEC_FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={createForm[f.key]}
                  onChange={(e) => setCreateField(f.key, e.target.value)}
                />
              </div>
            ))}
            <div className="field">
              <label>사양</label>
              <textarea value={createForm.spec} onChange={(e) => setCreateField('spec', e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={creating}>
                {creating ? '등록 중...' : '등록'}
              </button>
              <UndoHint canUndo={canUndoCreate} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
