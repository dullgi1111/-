export function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat" style={color ? { '--sc': color } : undefined}>
      <div className="stat-label">{label}</div>
      <div className="stat-num">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
