import { useCallback, useRef, useState } from 'react';

const COALESCE_MS = 800;

// Direct-input forms (equipment spec, inventory quantity, ...) share this: Ctrl+Z
// steps back one field-edit at a time, Ctrl+Shift+Z reverts everything to the
// values the form was loaded with. Consecutive keystrokes in the same field are
// coalesced into a single undo step so undo doesn't walk back one character at a time.
export function useUndoableForm(initialValues) {
  const initialRef = useRef(initialValues);
  const valuesRef = useRef(initialValues);
  const [values, setValues] = useState(initialValues);
  const historyRef = useRef([]);
  const [historyLength, setHistoryLength] = useState(0);
  const pendingFieldRef = useRef(null);
  const pendingTimerRef = useRef(null);

  const setValue = useCallback((field, value) => {
    if (pendingFieldRef.current !== field) {
      historyRef.current.push(valuesRef.current);
      setHistoryLength(historyRef.current.length);
    }
    pendingFieldRef.current = field;
    clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      pendingFieldRef.current = null;
    }, COALESCE_MS);
    const next = { ...valuesRef.current, [field]: value };
    valuesRef.current = next;
    setValues(next);
  }, []);

  const undo = useCallback(() => {
    const stack = historyRef.current;
    if (stack.length === 0) return;
    const prev = stack.pop();
    setHistoryLength(stack.length);
    pendingFieldRef.current = null;
    valuesRef.current = prev;
    setValues(prev);
  }, []);

  const resetAll = useCallback(() => {
    historyRef.current = [];
    setHistoryLength(0);
    pendingFieldRef.current = null;
    valuesRef.current = initialRef.current;
    setValues(initialRef.current);
  }, []);

  // Load a fresh baseline (e.g. switching to a different record) without it
  // counting as an undoable edit.
  const replaceAll = useCallback((next) => {
    initialRef.current = next;
    historyRef.current = [];
    setHistoryLength(0);
    pendingFieldRef.current = null;
    valuesRef.current = next;
    setValues(next);
  }, []);

  return { values, setValue, undo, resetAll, replaceAll, canUndo: historyLength > 0 };
}

export function handleUndoKeyDown(e, { undo, resetAll }) {
  const isMod = e.ctrlKey || e.metaKey;
  if (!isMod || e.key.toLowerCase() !== 'z') return;
  e.preventDefault();
  if (e.shiftKey) resetAll();
  else undo();
}
