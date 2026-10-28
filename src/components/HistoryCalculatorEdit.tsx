"use client";

import Calculator from "./Calculator";

/**
 * Full Calculator UI embedded for history edit.
 * Parent must give a bounded height (overflow handled inside Calculator).
 */
export default function HistoryCalculatorEdit({ record, onClose, onSaved }) {
  if (!record) return null;
  return (
    <Calculator
      editRecord={record}
      embedded
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
