import { useEffect, useRef, useState } from 'react';
import * as importsApi from '../api/imports.api';
import { useToast } from '../components/ToastProvider';
import { HelpButton, HelpSection } from '../components/HelpButton';
import { guessMapping, SYSTEM_FIELD_HINTS } from '../utils/columnMapping';
import { downloadCsv } from '../utils/csvExport';

const SYSTEM_FIELDS = [
  { key: 'equipmentName', label: '설비명', required: true },
  { key: 'recordDate', label: '작업일자', required: true },
  { key: 'maintenanceType', label: '정비유형 (선택)', required: false },
  { key: 'workName', label: '작업명', required: false },
  { key: 'workContent', label: '작업내용', required: false },
  { key: 'workTeam', label: '수행반', required: false },
  { key: 'symptomText', label: '현상', required: false },
  { key: 'actionText', label: '조치', required: false },
  { key: 'partText', label: '부품명', required: false },
  { key: 'companySource', label: '등록 업체', required: false },
];

const STEP_LABELS = ['파일 선택', '미리보기 및 저장'];
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

function downloadTemplate() {
  const headers = SYSTEM_FIELDS.map((f) => ({ key: f.key, label: SYSTEM_FIELD_HINTS[f.key]?.[0] || f.label }));
  const sampleRow = {
    equipmentName: '1호기 컨베이어',
    recordDate: '2026-01-15',
    maintenanceType: '고장수리',
    workName: '컨베이어 모터 교체 작업',
    workContent: '베어링 소음 발생으로 구동모터 교체',
    workTeam: '기계/장치',
    symptomText: '고장.결함.수명소진',
    actionText: '설비/부품 교체',
    partText: '구동모터',
    companySource: 'KEP',
  };
  downloadCsv('업로드_표준양식.csv', headers, [sampleRow]);
}

export function UploadWizardPage() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [companySource, setCompanySource] = useState('');
  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState(null);
  const [sampleRows, setSampleRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [committing, setCommitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorRows, setErrorRows] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [mappingConfidence, setMappingConfidence] = useState({});
  const [mappingError, setMappingError] = useState(null);

  async function handleUpload() {
    if (files.length === 0) {
      toast.error('파일을 선택하세요');
      return;
    }
    setUploading(true);
    setMappingError(null);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const data = await importsApi.uploadFile(files, companySource, controller.signal);
      const { guessed, confidence } = guessMapping(data.detectedColumns, SYSTEM_FIELDS);

      const requiredMissing = SYSTEM_FIELDS.filter((f) => f.required && !guessed[f.key]);
      if (requiredMissing.length === 0) {
        setBatch({ id: data.batchId });
        setSampleRows(data.sampleRows);
        setMapping(guessed);
        setMappingConfidence(confidence);
        toast.success('컬럼을 자동으로 인식했습니다');
        await submitMapping(data.batchId, guessed);
      } else {
        // Can't confidently place the required columns, and there's no manual mapping
        // screen to fall back to -- reject the upload and tell the user which
        // recognizable header names to use instead, rather than asking them to map
        // system-internal field names to their columns themselves.
        try {
          await importsApi.removeBatch(data.batchId);
        } catch {
          // batch may already be gone; ignore
        }
        setMappingError({ missingFields: requiredMissing, detectedColumns: data.detectedColumns });
        toast.error('필수 항목(설비명/날짜)에 해당하는 컬럼을 찾지 못했습니다');
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
      setStep(1);
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
    setSampleRows([]);
    setMapping({});
    setStatus(null);
    setErrorRows([]);
    setAnalysis(null);
    setAnalysisLoading(false);
    setMappingConfidence({});
    setMappingError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const fuzzyMatchedFields = SYSTEM_FIELDS
    .filter((f) => mappingConfidence[f.key] === 'fuzzy')
    .map((f) => f.label);

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
          <div className="card-t">
            <span>엑셀/CSV 파일 업로드</span>
            <span
              className="text-muted"
              style={{ fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              onClick={downloadTemplate}
            >
              표준 양식 다운로드
            </span>
          </div>

          {mappingError && (
            <div className="hint" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'transparent', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {mappingError.missingFields.map((f) => f.label).join(', ')} 컬럼을 찾지 못해 업로드하지 못했습니다.
              </div>
              <div style={{ marginBottom: 6 }}>
                파일의 컬럼 이름: {mappingError.detectedColumns.join(', ')}
              </div>
              <div>
                {mappingError.missingFields.map((f) => (
                  <div key={f.key}>
                    {f.label}으로 인식되는 이름 예시: {(SYSTEM_FIELD_HINTS[f.key] || []).slice(0, 5).join(', ')}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>
                엑셀 파일의 헤더(첫 행)를 위 이름 중 하나로 바꾸거나, "표준 양식 다운로드"를 받아 그 형식에 맞춰 다시 올려주세요.
              </div>
            </div>
          )}

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
            <input value={companySource} onChange={(e) => setCompanySource(e.target.value)} placeholder="예: KEP" />
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
          <div className="card-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>미리보기 및 저장</span>
            <HelpButton title="왜 미리보기 단계가 있나요?" width={480}>
              <HelpSection heading="아직 저장되지 않았어요">
                이 화면은 실제 저장 전에 결과를 미리 보여주는 단계입니다. 아래 숫자들은 지금 올린 파일을
                시스템이 어떻게 처리할지 예측한 결과이고, "이대로 저장하기"를 누르기 전까지는 정비 이력
                DB에 아무것도 반영되지 않습니다.
              </HelpSection>
              <HelpSection heading="숫자들이 뜻하는 것">
                "사전과 정확히 일치"는 이미 등록된 표준 용어와 똑같은 표현, "자동 병합 예상"은 표현이
                조금 다르지만 같은 용어로 자동 인식될 항목, "사전에 없는 새 표현"은 처음 보는 표현이라
                저장 시 새 용어로 자동 등록될 항목입니다.
              </HelpSection>
              <HelpSection heading="틀린 것 같으면">
                아래 미리보기 표에서 각 항목에 실제로 맞는 값이 들어갔는지 확인하세요. 잘못됐다면 저장하지
                말고 "취소"를 누른 뒤, 엑셀 파일의 헤더(첫 행)를 알아보기 쉬운 이름으로 바꿔서 다시
                올려주세요. 저장 후 문제를 발견해도 개별 항목은 정비 이력/설비 목록 화면에서 수정할 수
                있습니다.
              </HelpSection>
            </HelpButton>
          </div>
          {!status && (
            <>
              <p className="text-muted" style={{ marginBottom: 14 }}>
                아직 저장 전입니다. 아래 내용을 확인하고 이상이 없으면 "이대로 저장하기"를 눌러주세요.
              </p>

              {fuzzyMatchedFields.length > 0 && (
                <div className="hint" style={{ marginBottom: 14 }}>
                  <strong>{fuzzyMatchedFields.join(', ')}</strong>은(는) 컬럼 이름이 비슷해서 추정으로 연결한
                  항목입니다. 아래 미리보기 표에서 실제 값이 맞는지 한 번 확인해주세요.
                </div>
              )}

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
                      <div className="stat-sub">저장 시 자동으로 사전에 추가됩니다</div>
                    </div>
                  </div>
                  {analysis.missingRequiredCount > 0 && (
                    <div className="hint" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'transparent' }}>
                      설비명 또는 날짜가 비어있는 행이 {analysis.missingRequiredCount}건 있습니다. 이 행들은 저장 시 오류로
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
                  이대로 저장하기
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
