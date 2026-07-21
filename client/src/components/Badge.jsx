const MAINTENANCE_TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

const MAINTENANCE_TYPE_VARIANT = {
  breakdown_repair: 'danger',
  preventive_inspection: 'ok',
  other: 'purple',
  unknown: 'neutral',
};

const MATCH_TYPE_LABELS = {
  exact: '정확일치',
  alias_auto_merge: '자동병합',
  new_discovery: '신규발견',
  skipped_too_long: '장문(건너뜀)',
};

const MATCH_TYPE_VARIANT = {
  exact: 'ok',
  alias_auto_merge: 'accent',
  new_discovery: 'warn',
  skipped_too_long: 'neutral',
};

export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function MaintenanceTypeBadge({ type }) {
  return <Badge variant={MAINTENANCE_TYPE_VARIANT[type] || 'neutral'}>{MAINTENANCE_TYPE_LABELS[type] || type}</Badge>;
}

export function MatchTypeBadge({ type }) {
  return <Badge variant={MATCH_TYPE_VARIANT[type] || 'neutral'}>{MATCH_TYPE_LABELS[type] || type}</Badge>;
}
