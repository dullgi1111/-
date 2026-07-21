import { useEffect, useRef, useState } from 'react';
import * as importsApi from '../api/imports.api';
import { useToast } from '../components/ToastProvider';

const SYSTEM_FIELDS = [
  { key: 'equipmentName', label: '설비명', required: true },
  { key: 'recordDate', label: '날짜', required: true },
  { key: 'maintenanceType', label: '정비유형 (선택)', required: false },
  { key: 'symptomText', label: '증상', required: false },
  { key: 'actionText', label: '조치내용', required: false },
  { key: 'partText', label: '부품명', required: false },
  { key: 'companySource', label: '등록 업체', required: false },
];

// Ordered most-specific-first so e.g. "점검일자" wins over the generic "날짜" for recordDate.
const SYSTEM_FIELD_HINTS = {
  equipmentName: ['설비명', '기기명', '장비명', '설비', '기기'],
  recordDate: ['점검일자', '정비일자', '작업일자', '일자', '날짜'],
  maintenanceType: ['정비유형', '구분', '유형', '종류'],
  symptomText: ['증상', '고장증상', '고장내용', '현상'],
  actionText: ['조치내용', '조치사항', '수리내용', '작업내용', '조치'],
  partText: ['부품명', '자재명', '부품', '자재'],
  companySource: ['등록업체', '정비업체', '작업업체', '업체명', '업체'],
};

function guessMapping(detectedColumns) {
  const guessed = {};
  const used = new Set();
  const trimmed = detectedColumns.map((c) => ({ raw: c, trimmed: c.trim() }));

  for (const field of SYSTEM_FIELDS) {
    const hints = SYSTEM_FIELD_HINTS[field.key] || [];
    let match = null;
    for (const hint of hints) {
      const exact = trimmed.find((c) => !used.has(c.raw) && c.trimmed === hint);
      if (exact) { match = exact.raw; break; }
    }
    if (!match) {
      for (const hint of hints) {
        const partial = trimmed.find((c) => !used.has(c.raw) && c.trimmed.includes(hint));
        if (partial) { match = partial.raw; break; }
      }
    }
    if (match) {
      guessed[field.key] = match;
      used.add(match);
    }
  }
  return guessed;
}

const STEP_LABELS = ['파일 선택', '컬럼 매핑', '검토 및 커밋'];
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export function UploadWizardPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [companySource, setCompanySource] = useState('');
  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState(null);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [committing, setCommitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorRows, setErrorRows] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [autoMapped, setAutoMapped] = useState(false);

  async function handleUpload() {
    if (files.length === 0) {
      toast.error('파일을 선택하세요');
      return;
    }
    setUploading(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const data = await importsApi.uploadFile(files, companySource, controller.signal);
      setBatch({ id: data.batchId });
      setDetectedColumns(data.detectedColumns);
      setSampleRows(data.sampleRows);
      const guessed = guessMapping(data.detectedColumns);
      setMapping(guessed);

      const requiredMissing = SYSTEM_FIELDS.filter((f) => f.required && !guessed[f.key]);
      if (requiredMissing.length === 0) {
        // Confident auto-mapping: skip the manual mapping screen entirely.
        setAutoMapped(true);
        toast.success('컬럼을 자동으로 인식했습니다');
        await submitMapping(data.batchId, guessed);
      } else {
        setAutoMapped(false);
        setStep(1);
      }
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

  async function handleCancelBatch() {
    if (batch) {
      try {
        await importsApi.removeBatch(batch.id);
      } catch {
        // batch may already be gone; ignore
      }
    }
    resetWizard();
    toast.info('업로드를 취소했습니다');
  }

  async function submitMapping(batchId, mappingToUse) {
    try {
      await importsApi.setMapping(batchId, { companySource, columnMapping: mappingToUse });
      setStep(2);
      setAnalysisLoading(true);
      try {
        const stats = await importsApi.analyze(batchId);
        setAnalysis(stats);
      } catch (err) {
        toast.error(`사전 대조 분석에 실패했습니다: ${err.message}`);
      } finally {
        setAnalysisLoading(false);
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSaveMapping() {
    const missing = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      toast.error(`필수 필드를 매핑하세요: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setAutoMapped(false);
    await submitMapping(batch.id, mapping);
  }

  async function handleCommit() {
    setCommitting(true);
    try {
      await importsApi.commit(batch.id);
      setStatus({ status: 'processing', processed_rows: 0, total_rows: sampleRows.length });
    } catch (err) {
      toast.error(err.message);
      setCommitting(false);
    }
  }

  async function handleCancelProcessing() {
    try {
      await importsApi.cancelBatch(batch.id);
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    if (!batch || !committing) return undefined;
    const interval = setInterval(async () => {
      try {
        const data = await importsApi.getBatch(batch.id);
        setStatus(data);
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(interval);
          setCommitting(false);
          if (data.status === 'completed') toast.success('임포트가 완료되었습니다');
          if (data.status === 'failed') toast.error('임포트가 실패했습니다');
          if (data.status === 'cancelled') toast.info('임포트를 취소했습니다');
          if (data.error_rows > 0) {
            const errs = await importsApi.listErrors(batch.id);
            setErrorRows(errs);
          }
        }
      } catch {
        clearInterval(interval);
        setCommitting(false);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [batch, committing]);

  function resetWizard() {
    setStep(0);
    setFiles([]);
    setBatch(null);
    setDetectedColumns([]);
    setSampleRows([]);
    setMapping({});
    setStatus(null);
    setErrorRows([]);
    setAnalysis(null);
    setAnalysisLoading(false);
    setAutoMapped(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <div className="steps">
        {STEP_LABELS.map((label, idx) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`step-pill${idx === step ? ' active' : ''}${idx < step ? ' done' : ''}`}>
              {idx < step ? '✓' : idx + 1}. {label}
            </span>
            {idx < STEP_LABELS.length - 1 && <span className="step-sep" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card">
          <div className="card-t">엑셀/CSV 파일 업로드</div>
          <div className="field">
            <label>파일 (.xlsx, .xls, .csv, 여러 개 선택 가능)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>
          {files.length > 0 && (
            <div className="filter-row">
              {files.map((f, idx) => (
                <span key={idx} className="chip active">{f.name}</span>
              ))}
            </div>
          )}
          <div className="field">
            <label>등록 업체 (선택)</label>
            <input value={companySource} onChange={(e) => setCompanySource(e.target.value)} placeholder="예: OO정비업체" />
          </div>
          <div className="flex-between">
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? '업로드 중...' : '업로드'}
            </button>
            {uploading && (
              <button className="btn btn-secondary" onClick={handleCancelUpload}>
                취소
              </button>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <div className="card-t">
            <span>컬럼 매핑</span>
            <small>파일의 실제 컬럼을 시스템 필드에 연결하세요 ({sampleRows.length > 0 ? '여러 파일이 합쳐진 결과' : ''})</small>
          </div>
          <div className="form-grid" style={{ marginBottom: 14 }}>
            {SYSTEM_FIELDS.map((field) => (
              <div className="field" key={field.key}>
                <label>
                  {field.label}
                  {field.required && ' *'}
                </label>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">매핑 안 함</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="card-t" style={{ marginTop: 4 }}>
            <span>미리보기 (상위 {sampleRows.length}행)</span>
            <a className="btn btn-secondary btn-sm" href={importsApi.exportUrl(batch.id)} download>
              전체 데이터 내보내기
            </a>
          </div>
          <div className="table-scroll" style={{ marginBottom: 14 }}>
            <table className="tbl">
              <thead>
                <tr>
                  {SYSTEM_FIELDS.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, idx) => (
                  <tr key={idx}>
                    {SYSTEM_FIELDS.map((f) => (
                      <td key={f.key}>{mapping[f.key] ? row[mapping[f.key]] : <span className="text-muted">-</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex-between">
            <button className="btn btn-secondary" onClick={handleCancelBatch}>취소</button>
            <button className="btn btn-primary" onClick={handleSaveMapping}>다음: 검토 및 커밋</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-t">검토 및 커밋</div>
          {!status && (
            <>
              <p className="text-muted" style={{ marginBottom: 14 }}>
                커밋하면 전체 데이터를 분류·용어매칭 파이프라인에 태워 정비 이력 DB에 반영합니다.
              </p>

              {autoMapped && (
                <div className="hint" style={{ marginBottom: 14 }}>
                  컬럼을 자동으로 인식해서 매핑을 건너뛰었습니다.{' '}
                  <span
                    style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                    onClick={() => setStep(1)}
                  >
                    매핑 확인/수정
                  </span>
                </div>
              )}

              {analysisLoading && <div className="text-muted" style={{ marginBottom: 14 }}>사전과 대조 분석 중...</div>}

              {analysis && (
                <div style={{ marginBottom: 18 }}>
                  <div className="stat-row">
                    <div className="stat" style={{ '--sc': analysis.missingRequiredCount > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      <div className="stat-label">필수값 누락 행</div>
                      <div className="stat-num">{analysis.missingRequiredCount}</div>
                      <div className="stat-sub">전체 {analysis.totalRows}행 중</div>
                    </div>
                    <div className="stat" style={{ '--sc': 'var(--ok)' }}>
                      <div className="stat-label">사전과 정확히 일치</div>
                      <div className="stat-num">{analysis.phrase.exact}</div>
                    </div>
                    <div className="stat" style={{ '--sc': 'var(--accent)' }}>
                      <div className="stat-label">유사 표현으로 자동 병합 예상</div>
                      <div className="stat-num">{analysis.phrase.wouldAutoMerge}</div>
                    </div>
                    <div className="stat" style={{ '--sc': 'var(--warn)' }}>
                      <div className="stat-label">사전에 없는 새 표현</div>
                      <div className="stat-num">{analysis.phrase.newDiscovery}</div>
                      <div className="stat-sub">커밋 시 자동으로 사전에 추가됩니다</div>
                    </div>
                  </div>
                  {analysis.missingRequiredCount > 0 && (
                    <div className="hint" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'transparent' }}>
                      설비명 또는 날짜가 비어있는 행이 {analysis.missingRequiredCount}건 있습니다. 이 행들은 커밋 시 오류로
                      처리되어 저장되지 않습니다.
                    </div>
                  )}
                  {analysis.sampleNewPhrases.length > 0 && (
                    <div className="hint">
                      새로 발견될 표현 예시: {analysis.sampleNewPhrases.map((p) => p.phrase).join(', ')}
                      {analysis.phrase.newDiscovery > analysis.sampleNewPhrases.length && ' 외'}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-between">
                <button className="btn btn-primary" onClick={handleCommit} disabled={committing}>
                  커밋 시작
                </button>
                <button className="btn btn-secondary" onClick={handleCancelBatch}>취소</button>
              </div>
            </>
          )}
          {status && (
            <>
              <div className="flex-between" style={{ marginBottom: 10 }}>
                <span>
                  상태: <strong>{status.status}</strong>
                </span>
                <span className="mono">
                  {status.processed_rows} / {status.total_rows} 처리됨 (오류 {status.error_rows || 0}건)
                </span>
              </div>
              {status.status === 'processing' && (
                <div className="flex-between">
                  <div className="spinner" />
                  <button className="btn btn-secondary btn-sm" onClick={handleCancelProcessing}>
                    취소
                  </button>
                </div>
              )}
              {errorRows.length > 0 && (
                <div className="table-scroll" style={{ marginTop: 14 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>행 번호</th>
                        <th>오류 메시지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.row_number}</td>
                          <td>{r.error_message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {TERMINAL_STATUSES.includes(status.status) && (
                <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={resetWizard}>
                  새 업로드 시작
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
