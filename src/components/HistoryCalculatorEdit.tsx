"use client";

import LoadCalculator from "./LoadCalculator";

/**
 * Full LoadCalculator UI embedded for history edit.
 * Parent must give a bounded height (overflow handled inside LoadCalculator).
 */
export default function HistoryCalculatorEdit({ record, onClose, onSaved }) {
  if (!record) return null;
  return (
    <LoadCalculator
      editRecord={record}
      embedded
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
