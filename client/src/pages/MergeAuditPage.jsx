import { useEffect, useState } from 'react';
import * as auditApi from '../api/audit.api';
import { useToast } from '../components/ToastProvider';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function MergeAuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  function load() {
    setLoading(true);
    auditApi
      .listMerges({ limit: 100 })
      .then(setLogs)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleRevert(id) {
    const reason = window.prompt('되돌리는 이유를 입력하세요 (선택)') || '';
    setRevertingId(id);
    try {
      await auditApi.revertMerge(id, reason);
      toast.success('병합을 되돌렸습니다');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <div>
      <div className="hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span>
          자동 병합은 유사도 임계값 이상일 때 사람 개입 없이 즉시 실행됩니다. 잘못 병합된 항목은 여기서 되돌릴 수 있습니다.
        </span>
        <button
          onClick={() => setShowHelp(true)}
          aria-label="자동 병합 자세히 보기"
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ?
        </button>
      </div>

      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} title="자동 병합이란?" width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>어떻게 동작하나요?</div>
              정비 이력을 처리하는 중 새로 나온 표현(예: "베어링마모")이 기존 표준 용어(예: "베어링 마모")와의
              유사도가 기준치(기본 0.85) 이상이면, 시스템이 사람 확인 없이 즉시 그 표현을 별칭(alias)으로
              자동 병합합니다.
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>왜 사람이 매번 확인하지 않나요?</div>
              업로드되는 정비 이력의 양이 많아서 모든 신규 표현을 사람이 매번 검토하기엔 비효율적입니다.
              그래서 텍스트가 충분히 비슷한 경우엔 바로 합쳐서 자동으로 사전을 정리하고, 애매한 경우만
              "검토 필요" 상태로 남겨둡니다.
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>어떤 위험이 있나요?</div>
              텍스트 유사도만으로 판단하기 때문에, 실제로는 의미가 다른데 글자가 우연히 비슷해서
              잘못 합쳐지는 경우가 생길 수 있습니다. 이 화면(자동병합 로그)은 그런 자동 병합이 언제,
              어떤 유사도 점수로 일어났는지 전부 기록해두는 감사 로그입니다.
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>"되돌리기" 버튼은 뭔가요?</div>
              특정 자동 병합이 잘못됐다고 판단되면 "되돌리기"를 눌러 그 병합을 취소할 수 있습니다.
              되돌리면 해당 표현은 다시 별도의 표현으로 분리되어, 이후 정비 이력에서 독립적으로 처리됩니다.
            </div>
          </div>
        </Modal>
      )}
      <div className="card">
        <div className="card-t">
          <span>자동병합 로그</span>
          <small>{logs.length}건</small>
        </div>
        {loading && <div className="text-muted">불러오는 중...</div>}
        {!loading && logs.length === 0 && <EmptyState>아직 자동 병합된 항목이 없습니다.</EmptyState>}
        {!loading && logs.length > 0 && (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>표현</th>
                  <th>유사도</th>
                  <th>알고리즘</th>
                  <th>병합 시각</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.alias_text}</td>
                    <td className="mono">{Number(log.similarity_score).toFixed(3)}</td>
                    <td className="text-muted" style={{ fontSize: 11 }}>{log.algorithm_version}</td>
                    <td className="mono">{new Date(log.merged_at).toLocaleString('ko-KR')}</td>
                    <td>
                      {log.reverted_at ? (
                        <Badge variant="neutral">되돌림</Badge>
                      ) : (
                        <Badge variant="ok">유효</Badge>
                      )}
                    </td>
                    <td>
                      {!log.reverted_at && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={revertingId === log.id}
                          onClick={() => handleRevert(log.id)}
                        >
                          되돌리기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
