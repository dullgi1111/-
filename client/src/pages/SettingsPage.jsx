import { useEffect, useState } from 'react';
import * as settingsApi from '../api/settings.api';
import { useToast } from '../components/ToastProvider';

const SETTING_LABELS = {
  term_merge_threshold: '자동병합 유사도 임계값 (0~1)',
  classification_min_confidence: '정비유형 분류 최소 신뢰도 (0~1)',
  trgm_candidate_prefilter: 'DB 후보 검색 사전필터 유사도 (0~1)',
  trgm_candidate_limit: 'DB 후보 검색 개수 상한',
};

export function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((data) => {
        setSettings(data);
        setDrafts(Object.fromEntries(data.map((s) => [s.key, s.value])));
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.updateSettings(drafts);
      toast.success('설정을 저장했습니다');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted">불러오는 중...</div>;

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="card-t">시스템 설정</div>
      {settings.map((s) => (
        <div className="field" key={s.key}>
          <label>{SETTING_LABELS[s.key] || s.key}</label>
          <input
            value={drafts[s.key] ?? ''}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
          />
          {s.description && <div className="hint-text">{s.description}</div>}
        </div>
      ))}
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
