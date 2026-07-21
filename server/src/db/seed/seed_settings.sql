INSERT INTO system_settings (key, value, description) VALUES
  ('term_merge_threshold', '0.85', '유사도 이 값 이상이면 자동으로 기존 용어의 별칭으로 병합'),
  ('classification_min_confidence', '0.15', '이 신뢰도 미만이면 정비유형을 unknown으로 표시'),
  ('trgm_candidate_prefilter', '0.30', 'pg_trgm 후보 검색 시 사용하는 최소 유사도(성능용 사전 필터)'),
  ('trgm_candidate_limit', '20', '정밀 스코어링에 넘길 후보 개수 상한')
ON CONFLICT (key) DO NOTHING;
