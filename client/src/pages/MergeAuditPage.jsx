import { useEffect, useState } from 'react';
import * as auditApi from '../api/audit.api';
import { useToast } from '../components/ToastProvider';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';

export function MergeAuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState(null);

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
      <div className="hint">
        자동 병합은 유사도 임계값 이상일 때 사람 개입 없이 즉시 실행됩니다. 잘못 병합된 항목은 여기서 되돌릴 수 있습니다.
      </div>
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
