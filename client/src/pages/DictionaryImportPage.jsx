import { useRef, useState } from 'react';
import * as dictionaryApi from '../api/dictionary.api';
import { useToast } from '../components/ToastProvider';
import { EmptyState } from '../components/EmptyState';

const TERM_TYPE_LABELS = { symptom: '증상', action: '조치', part: '부품', auto: '자동 판단' };
const TERM_TYPE_OPTIONS = [
  { value: 'symptom', label: '증상' },
  { value: 'action', label: '조치' },
  { value: 'part', label: '부품' },
];

let entryIdCounter = 0;

export function DictionaryImportPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const [autoClassify, setAutoClassify] = useState(true);
  const [pendingTypes, setPendingTypes] = useState(['symptom']);
  const [entries, setEntries] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  function togglePendingType(value) {
    setPendingTypes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  }

  function handleAddFiles() {
    const files = Array.from(fileInputRef.current?.files || []);
    if (files.length === 0) {
      toast.error('추가할 파일을 선택하세요');
      return;
    }
    if (!autoClassify && pendingTypes.length === 0) {
      toast.error('구분을 최소 하나 선택하세요');
      return;
    }
    const types = autoClassify ? ['auto'] : pendingTypes;
    setEntries((prev) => [...prev, ...files.map((file) => ({ id: ++entryIdCounter, file, termTypes: types }))]);
    fileInputRef.current.value = '';
  }

  function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function resetAll() {
    setEntries([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleImport() {
    if (entries.length === 0) {
      toast.error('가져올 파일이 없습니다');
      return;
    }
    setUploading(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const data = await dictionaryApi.importFiles(entries, controller.signal);
      setResult(data);
      setEntries([]);
      toast.success('용어 사전에 반영되었습니다');
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(err.message);
    } finally {
      setUploading(false);
      uploadAbortRef.current = null;
    }
  }

  function handleCancelUpload() {
    uploadAbortRef.current?.abort();
  }

  return (
    <div>
      <div className="hint">
        기본값은 "자동 판단"이라 파일 안에 증상/조치/부품이 섞여 있어도 알아서 나눠 등록합니다. 구분을 직접
        지정하고 싶으면 자동 판단을 끄고 골라주세요. 가져오면 바로 표준 용어로 등록됩니다.
      </div>

      {!result && (
        <>
          <div className="card">
            <div className="card-t">파일 추가</div>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="field">
                <label>파일 (.pdf, .docx, .xlsx, .xls, .csv, 여러 개 선택 가능)</label>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv" multiple />
              </div>
              <div className="field">
                <label>이 파일들의 구분</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  <input type="checkbox" checked={autoClassify} onChange={(e) => setAutoClassify(e.target.checked)} />
                  자동으로 판단 (추천)
                </label>
                {!autoClassify && (
                  <>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', height: 36 }}>
                      {TERM_TYPE_OPTIONS.map((opt) => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={pendingTypes.includes(opt.value)}
                            onChange={() => togglePendingType(opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    <div className="hint-text">여러 구분을 체크하면 같은 파일이 각 구분에 모두 등록됩니다.</div>
                  </>
                )}
                {autoClassify && (
                  <div className="hint-text">파일 안에 증상/조치/부품이 섞여 있어도 단어별로 알아서 나눠 등록합니다.</div>
                )}
              </div>
            </div>
            <button className="btn btn-secondary" onClick={handleAddFiles}>목록에 추가</button>
          </div>

          <div className="card">
            <div className="card-t">
              <span>가져올 파일 목록</span>
              <small>{entries.length}개</small>
            </div>
            {entries.length === 0 ? (
              <EmptyState>위에서 파일을 추가하세요.</EmptyState>
            ) : (
              <div className="table-scroll" style={{ marginBottom: 14 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>파일명</th>
                      <th>구분</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>{e.file.name}</td>
                        <td>{e.termTypes.map((t) => TERM_TYPE_LABELS[t]).join(', ')}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => removeEntry(e.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex-between">
              <button className="btn btn-secondary" onClick={resetAll} disabled={entries.length === 0 || uploading}>
                취소
              </button>
              {!uploading ? (
                <button className="btn btn-primary" onClick={handleImport} disabled={entries.length === 0}>
                  용어 사전에 가져오기
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div className="spinner" />
                  <button className="btn btn-secondary" onClick={handleCancelUpload}>취소</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {result && (
        <div className="card">
          <div className="card-t">가져오기 결과</div>
          <div className="stat-row">
            <div className="stat" style={{ '--sc': 'var(--ok)' }}>
              <div className="stat-label">신규 등록</div>
              <div className="stat-num">{result.created}</div>
            </div>
            <div className="stat" style={{ '--sc': 'var(--accent)' }}>
              <div className="stat-label">기존 용어에 정의 추가</div>
              <div className="stat-num">{result.updatedExisting}</div>
            </div>
            <div className="stat" style={{ '--sc': 'var(--accent)' }}>
              <div className="stat-label">정의 추가됨</div>
              <div className="stat-num">{result.definitionsAdded}</div>
            </div>
            <div className="stat" style={{ '--sc': 'var(--warn)' }}>
              <div className="stat-label">별칭 추가</div>
              <div className="stat-num">{result.aliasesAdded}</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <EmptyState>
              {result.errors.length}건은 용어가 비어있어 건너뛰었습니다.
            </EmptyState>
          )}
          {result.emptyFiles?.length > 0 && (
            <div className="hint" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', borderColor: 'transparent', marginTop: 12 }}>
              다음 파일에서는 텍스트를 하나도 추출하지 못했습니다: {result.emptyFiles.join(', ')}. PDF 저장 방식(글자를
              그림처럼 저장하는 경우) 문제일 수 있으니, 원본이 워드/한글/엑셀이라면 그 파일을 그대로 올려보세요.
            </div>
          )}
          <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={resetAll}>
            새 파일 가져오기
          </button>
        </div>
      )}
    </div>
  );
}
