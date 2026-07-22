import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as dictionaryApi from '../api/dictionary.api';
import { useToast } from '../components/ToastProvider';
import { EmptyState } from '../components/EmptyState';
import { Badge, MaintenanceTypeBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { downloadCsv } from '../utils/csvExport';

const TERM_TYPE_LABELS = { symptom: '증상', action: '조치', part: '부품' };

const CSV_HEADERS = [
  { key: 'term_type', label: '구분' },
  { key: 'canonical_text', label: '표준 용어' },
  { key: 'origin', label: '출처' },
  { key: 'occurrence_count', label: '사용 횟수' },
  { key: 'needs_review', label: '검토 필요' },
];

function csvAccessor(row, key) {
  if (key === 'term_type') return TERM_TYPE_LABELS[row.term_type] || row.term_type;
  if (key === 'needs_review') return row.needs_review ? 'Y' : 'N';
  return row[key];
}

export function DictionaryPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const needsReviewOnly = searchParams.get('needsReview') === 'true';
  const [termType, setTermType] = useState('');
  const [search, setSearch] = useState('');
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aliasDrafts, setAliasDrafts] = useState({});
  const [viewTerm, setViewTerm] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [typoCheck, setTypoCheck] = useState(null);
  const [typoChecking, setTypoChecking] = useState(false);
  const [applyingCorrection, setApplyingCorrection] = useState(false);

  function load() {
    setLoading(true);
    dictionaryApi
      .listTerms({ termType, search, needsReview: needsReviewOnly ? 'true' : undefined, limit: 100 })
      .then(setTerms)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termType, needsReviewOnly]);

  function toggleNeedsReview() {
    if (needsReviewOnly) {
      searchParams.delete('needsReview');
    } else {
      searchParams.set('needsReview', 'true');
    }
    setSearchParams(searchParams);
  }

  async function handleMarkReviewed(id) {
    try {
      await dictionaryApi.markReviewed(id);
      toast.success('검토 완료로 표시했습니다');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleAddAlias(id) {
    const aliasText = aliasDrafts[id];
    if (!aliasText?.trim()) return;
    try {
      await dictionaryApi.addAlias(id, aliasText.trim());
      toast.success('별칭이 추가되었습니다');
      setAliasDrafts((prev) => ({ ...prev, [id]: '' }));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleView(id) {
    setViewLoading(true);
    setTypoCheck(null);
    try {
      const data = await dictionaryApi.getTerm(id);
      setViewTerm(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setViewLoading(false);
    }
  }

  async function handleCheckTypo() {
    setTypoChecking(true);
    setTypoCheck(null);
    try {
      const result = await dictionaryApi.checkTypo(viewTerm.id);
      setTypoCheck(result);
      if (!result.hasSuggestion) toast.success('맞춤법 이상 없음');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTypoChecking(false);
    }
  }

  async function handleApplyCorrection() {
    if (!typoCheck?.suggestedText) return;
    if (!window.confirm(`"${viewTerm.canonical_text}"을(를) "${typoCheck.suggestedText}"(으)로 수정할까요?`)) return;
    setApplyingCorrection(true);
    try {
      await dictionaryApi.applyCorrection(viewTerm.id, typoCheck.suggestedText);
      toast.success('수정했습니다');
      setTypoCheck(null);
      const data = await dictionaryApi.getTerm(viewTerm.id);
      setViewTerm(data);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApplyingCorrection(false);
    }
  }

  async function handleDelete(id, canonicalText) {
    if (!window.confirm(`"${canonicalText}"을(를) 삭제할까요? 이미 등록된 정비 이력의 연결은 그대로 유지되고, 목록에서만 사라집니다.`)) return;
    try {
      await dictionaryApi.removeTerm(id);
      toast.success('삭제했습니다');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('용어 사전 전체를 삭제할까요? (현재 필터와 상관없이 등록된 모든 용어가 삭제됩니다) 이미 등록된 정비 이력의 연결은 그대로 유지되고, 목록에서만 사라집니다.')) return;
    if (!window.confirm('정말로 전체 삭제하시겠습니까? 다시 한번 확인해주세요.')) return;
    try {
      const result = await dictionaryApi.removeAllTerms();
      toast.success(`${result.deletedCount}건 삭제했습니다`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="filter-row">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="용어 검색" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
          <button className="btn btn-secondary btn-sm" type="submit">검색</button>
        </form>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', 'symptom', 'action', 'part'].map((t) => (
            <span key={t} className={`chip${termType === t ? ' active' : ''}`} onClick={() => setTermType(t)}>
              {t ? TERM_TYPE_LABELS[t] : '전체'}
            </span>
          ))}
        </div>
        <span className={`chip${needsReviewOnly ? ' active' : ''}`} onClick={toggleNeedsReview}>
          검토 필요만
        </span>
      </div>

      <div className="card">
        <div className="card-t">
          <span>용어 사전</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <small>{terms.length}건</small>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCsv('용어사전.csv', CSV_HEADERS, terms, csvAccessor)}
              disabled={terms.length === 0}
            >
              내보내기
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteAll} disabled={terms.length === 0}>
              전체 삭제
            </button>
          </div>
        </div>
        {loading && <div className="text-muted">불러오는 중...</div>}
        {!loading && terms.length === 0 && <EmptyState>조건에 맞는 용어가 없습니다.</EmptyState>}
        {!loading && terms.length > 0 && (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>표준 용어</th>
                  <th>정의</th>
                  <th>출처</th>
                  <th>사용 횟수</th>
                  <th>상태</th>
                  <th>별칭 추가</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t) => (
                  <tr key={t.id}>
                    <td>{TERM_TYPE_LABELS[t.term_type] || t.term_type}</td>
                    <td>
                      <span
                        onClick={() => handleView(t.id)}
                        style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {t.canonical_text}
                      </span>
                    </td>
                    <td>
                      {t.definition_count > 0 ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleView(t.id)}>
                          정의 ({t.definition_count})
                        </button>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }}>없음</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={t.origin === 'auto_discovered' ? 'warn' : t.origin === 'manual' ? 'accent' : 'neutral'}>
                        {t.origin === 'auto_discovered' ? '자동발견' : t.origin === 'manual' ? '수동등록' : '초기값'}
                      </Badge>
                    </td>
                    <td className="mono">{t.occurrence_count}</td>
                    <td>{t.needs_review ? <Badge variant="warn">검토 필요</Badge> : <Badge variant="ok">확인됨</Badge>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          style={{ width: 110 }}
                          value={aliasDrafts[t.id] || ''}
                          onChange={(e) => setAliasDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="별칭 입력"
                        />
                        <button className="btn btn-secondary btn-sm" onClick={() => handleAddAlias(t.id)}>
                          추가
                        </button>
                      </div>
                    </td>
                    <td>
                      {t.needs_review && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleMarkReviewed(t.id)}>
                          검토 완료
                        </button>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.canonical_text)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(viewTerm || viewLoading) && (
        <Modal onClose={() => { setViewTerm(null); setTypoCheck(null); }} title="용어 상세" width={560}>
          {viewLoading && !viewTerm ? (
            <div className="text-muted">불러오는 중...</div>
          ) : (
            <>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div>
                  <div className="stat-label">구분</div>
                  <div>{TERM_TYPE_LABELS[viewTerm.term_type] || viewTerm.term_type}</div>
                </div>
                <div>
                  <div className="stat-label">표준 용어</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{viewTerm.canonical_text}</span>
                    <button className="btn btn-secondary btn-sm" onClick={handleCheckTypo} disabled={typoChecking}>
                      {typoChecking ? '확인 중...' : '맞춤법 확인 (웹검색)'}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="stat-label">사용 횟수</div>
                  <div className="mono">{viewTerm.occurrence_count}</div>
                </div>
                <div>
                  <div className="stat-label">상태</div>
                  <div>{viewTerm.needs_review ? <Badge variant="warn">검토 필요</Badge> : <Badge variant="ok">확인됨</Badge>}</div>
                </div>
              </div>
              {typoCheck?.hasSuggestion && (
                <div className="hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span>
                    웹 검색 결과 다른 표기가 있을 수 있습니다: <strong>{viewTerm.canonical_text}</strong> → <strong>{typoCheck.suggestedText}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleApplyCorrection} disabled={applyingCorrection}>
                      {applyingCorrection ? '수정 중...' : '수정'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setTypoCheck(null)}>
                      무시
                    </button>
                  </div>
                </div>
              )}

              <div className="card-t" style={{ marginTop: 4 }}>
                <span>정의</span>
                <small>여러 자료에서 모은 정의 {viewTerm.definitions.length}건</small>
              </div>
              {viewTerm.definitions.length === 0 ? (
                <EmptyState>등록된 정의가 없습니다.</EmptyState>
              ) : (
                <div className="table-scroll" style={{ marginBottom: 14 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>정의</th>
                        <th>출처</th>
                        <th>등록일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewTerm.definitions.map((d) => (
                        <tr key={d.id}>
                          <td>{d.definition_text}</td>
                          <td>{d.source_label || <span className="text-muted">-</span>}</td>
                          <td className="mono">{new Date(d.created_at).toLocaleDateString('ko-KR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="card-t" style={{ marginTop: 4 }}>
                <span>별칭</span>
                <small>{viewTerm.aliases.length}건</small>
              </div>
              {viewTerm.aliases.length === 0 ? (
                <EmptyState>등록된 별칭이 없습니다.</EmptyState>
              ) : (
                <div className="table-scroll" style={{ marginBottom: 14 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>별칭</th>
                        <th>출처</th>
                        <th>유사도</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewTerm.aliases.map((a) => (
                        <tr key={a.id}>
                          <td>{a.alias_text}</td>
                          <td>{a.source === 'auto_merge' ? '자동병합' : a.source === 'manual' ? '수동등록' : '초기값'}</td>
                          <td className="mono">{a.matched_similarity !== null ? Number(a.matched_similarity).toFixed(2) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="card-t" style={{ marginTop: 4 }}>
                <span>최근 사용된 정비 이력</span>
                <small>최대 10건</small>
              </div>
              {viewTerm.recentRecords.length === 0 ? (
                <EmptyState>이 용어를 사용한 정비 이력이 아직 없습니다.</EmptyState>
              ) : (
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>설비명</th>
                        <th>날짜</th>
                        <th>유형</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewTerm.recentRecords.map((r) => (
                        <tr key={r.id}>
                          <td>{r.equipment_name}</td>
                          <td className="mono">{r.record_date}</td>
                          <td><MaintenanceTypeBadge type={r.maintenance_type} /></td>
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
