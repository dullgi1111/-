import { useEffect, useState } from 'react';
import * as typeMapApi from '../api/maintenanceTypeMap.api';
import { useToast } from '../components/ToastProvider';
import { EmptyState } from '../components/EmptyState';
import { MaintenanceTypeBadge } from '../components/Badge';
import { HelpButton, HelpSection } from '../components/HelpButton';

const TYPE_OPTIONS = [
  { value: 'breakdown_repair', label: '고장수리' },
  { value: 'preventive_inspection', label: '예방점검' },
  { value: 'other', label: '기타' },
];

export function ClassificationMapPage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawValue, setRawValue] = useState('');
  const [maintenanceType, setMaintenanceType] = useState(TYPE_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    typeMapApi
      .listMappings()
      .then(setRows)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!rawValue.trim()) return;
    setSaving(true);
    try {
      await typeMapApi.createMapping({ rawValue: rawValue.trim(), maintenanceType });
      toast.success('규칙을 추가했습니다');
      setRawValue('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, label) {
    if (!window.confirm(`"${label}" 규칙을 삭제할까요? 이후 이 값이 올라오면 자동 확정되지 않고 분류 검토 필요 상태로 남습니다.`)) return;
    try {
      await typeMapApi.removeMapping(id);
      toast.success('삭제했습니다');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="filter-row">
        <span style={{ fontSize: 13, color: 'var(--ink3)' }}>
          엑셀 업로드 시 "정비유형" 컬럼으로 매핑한 원본값(예: 현상)이 아래 표와 정확히 일치하면
          자동으로 확정 분류됩니다. 표에 없는 값은 추측하지 않고 "분류 검토 필요"로 남습니다.
        </span>
        <HelpButton title="이 표는 왜 있나요?" width={460}>
          <HelpSection heading="점수로 추측하지 않고, 표를 그대로 찾아봅니다">
            예전에는 증상/조치 문구에 등록된 키워드가 있으면 가중치를 합산해 그럴듯한 유형을
            추정했습니다. 이제는 그렇게 하지 않습니다. 업로드된 원본값이 이 표에 정확히 있으면 그
            값 그대로 확정하고, 없으면 추측하지 않고 사람이 확인하도록 남겨둡니다.
          </HelpSection>
          <HelpSection heading="새로운 값이 계속 보류로 쌓인다면">
            정비 이력 화면의 "분류 검토 필요" 필터에서 어떤 원본값들이 안 걸리는지 확인한 뒤, 여기
            표에 규칙을 추가하면 다음 업로드부터 자동 확정됩니다. 이미 저장된 과거 이력은 규칙을
            바꿔도 소급 변경되지 않습니다.
          </HelpSection>
        </HelpButton>
      </div>

      <div className="card">
        <div className="card-t">
          <span>정비유형 판정표</span>
          <small>{rows.length}건</small>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="원본값 (예: 고장.결함.수명소진)"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !rawValue.trim()}>
            {saving ? '추가 중...' : '규칙 추가'}
          </button>
        </form>

        {loading && <div className="text-muted">불러오는 중...</div>}
        {!loading && rows.length === 0 && <EmptyState>등록된 규칙이 없습니다. 위에서 추가해주세요.</EmptyState>}
        {!loading && rows.length > 0 && (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>원본값</th>
                  <th>정비유형</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.raw_value_normalized}</td>
                    <td><MaintenanceTypeBadge type={r.maintenance_type} /></td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id, r.raw_value_normalized)}>
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
    </div>
  );
}
