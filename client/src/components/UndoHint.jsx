// Small discoverability label for useUndoableForm's keyboard shortcuts.
export function UndoHint({ canUndo }) {
  return (
    <div
      className="text-muted"
      style={{ fontSize: 11, marginTop: 6, opacity: canUndo ? 0.85 : 0.5 }}
    >
      Ctrl+Z 되돌리기 · Ctrl+Shift+Z 전체 초기화
    </div>
  );
}
