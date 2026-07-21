import { useState } from 'react';
import * as recordsApi from '../api/records.api';
import { useToast } from '../components/ToastProvider';
import { MaintenanceTypeBadge, MatchTypeBadge } from '../components/Badge';

const EMPTY_FORM = {
  equipmentName: '',
  recordDate: '',
  companySource: '',
  maintenanceTypeRawValue: '',
  symptomText: '',
  actionText: '',
  partText: '',
};

export function ManualEntryPage() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.equipmentName || !form.recordDate) {
      toast.error('설비명과 날짜는 필수입니다');
      return;
    }
    setSubmitting(true);
    try {
      const data = await recordsApi.createRecord(form);
      setResult(data);
      toast.success('정비 이력이 등록되었습니다');
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="hint">설비명과 날짜는 필수이며, 정비유형을 비워두면 증상·조치내용 텍스트를 기반으로 자동 분류됩니다.</div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="card-t">새 정비 이력 입력</div>
        <div className="form-grid">
          <div className="field">
            <label>설비명 *</label>
            <input value={form.equipmentName} onChange={(e) => updateField('equipmentName', e.target.value)} placeholder="예: 3호기 펌프" />
          </div>
          <div className="field">
            <label>날짜 *</label>
            <input type="date" value={form.recordDate} onChange={(e) => updateField('recordDate', e.target.value)} />
          </div>
          <div className="field">
            <label>등록 업체</label>
            <input value={form.companySource} onChange={(e) => updateField('companySource', e.target.value)} placeholder="예: OO정비업체" />
          </div>
          <div className="field">
            <label>정비유형 (원본 표기, 선택)</label>
            <input
              value={form.maintenanceTypeRawValue}
              onChange={(e) => updateField('maintenanceTypeRawValue', e.target.value)}
              placeholder="비워두면 자동 분류"
            />
          </div>
        </div>
        <div className="field">
          <label>증상</label>
          <textarea value={form.symptomText} onChange={(e) => updateField('symptomText', e.target.value)} placeholder="예: 베어링 마모, 소음 발생" />
        </div>
        <div className="field">
          <label>조치내용</label>
          <textarea value={form.actionText} onChange={(e) => updateField('actionText', e.target.value)} placeholder="예: 모터 교체" />
        </div>
        <div className="field">
          <label>부품명</label>
          <input value={form.partText} onChange={(e) => updateField('partText', e.target.value)} placeholder="예: 베어링" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? '등록 중...' : '등록'}
        </button>
      </form>

      {result && (
        <div className="card">
          <div className="card-t">등록 결과</div>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <span>
              {result.record.equipment_name} · {result.record.record_date}
            </span>
            <MaintenanceTypeBadge type={result.record.maintenance_type} />
          </div>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>필드</th>
                  <th>추출된 표현</th>
                  <th>매칭 결과</th>
                  <th>유사도</th>
                </tr>
              </thead>
              <tbody>
                {result.links.map((link) => (
                  <tr key={link.id}>
                    <td>{link.field_type}</td>
                    <td>{link.raw_phrase}</td>
                    <td><MatchTypeBadge type={link.match_type} /></td>
                    <td className="mono">{link.similarity_score !== null ? Number(link.similarity_score).toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
