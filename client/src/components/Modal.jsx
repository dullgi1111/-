export function Modal({ onClose, title, children, width }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}
