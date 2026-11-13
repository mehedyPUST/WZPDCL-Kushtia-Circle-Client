/**
 * Keyboard navigation between calculator input fields.
 * Inputs should set data-nav="1" and optional data-nav-row / data-nav-col.
 */

export function focusNavTarget(el: HTMLElement | null) {
  if (!el || typeof el.focus !== "function") return;
  el.focus();
  try {
    if ("select" in el && typeof (el as HTMLInputElement).select === "function") {
      (el as HTMLInputElement).select();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Move focus among [data-nav="1"] inputs using arrow keys.
 * @returns {boolean} true if navigation consumed the event
 */
export function navigateInputsByArrow(e: {
  key: string;
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
}) {
  const key = e.key;
  if (
    key !== "ArrowUp" &&
    key !== "ArrowDown" &&
    key !== "ArrowLeft" &&
    key !== "ArrowRight"
  ) {
    return false;
  }

  const current = e.target as HTMLInputElement | null;
  if (!current || typeof current.getAttribute !== "function") return false;
  if (current.getAttribute("data-nav") !== "1") return false;

  const root: Document | Element =
    current.closest("[data-nav-root]") ||
    current.closest(".calc-shell") ||
    document;
  const nodes = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[data-nav="1"]')
  ).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!nodes.length) return false;

  const idx = nodes.indexOf(current);
  if (idx < 0) return false;

  const rowOf = (el: HTMLInputElement) => {
    const r = el.getAttribute("data-nav-row");
    return r != null && r !== "" ? Number(r) : nodes.indexOf(el);
  };
  const colOf = (el: HTMLInputElement) => {
    const c = el.getAttribute("data-nav-col");
    return c != null && c !== "" ? Number(c) : 0;
  };

  const curRow = rowOf(current);
  const curCol = colOf(current);

  let next: HTMLInputElement | null = null;

  if (key === "ArrowDown" || key === "ArrowUp") {
    const dir = key === "ArrowDown" ? 1 : -1;
    // Prefer same column, next/prev row
    const candidates = nodes
      .filter((el) => colOf(el) === curCol)
      .sort((a, b) => rowOf(a) - rowOf(b));
    const pos = candidates.indexOf(current);
    if (pos >= 0) {
      next = candidates[pos + dir] || null;
    }
    // Fallback: sequential list
    if (!next) {
      next = nodes[idx + dir] || null;
    }
  } else if (key === "ArrowLeft" || key === "ArrowRight") {
    const dir = key === "ArrowRight" ? 1 : -1;
    // Prefer same row, next/prev column
    const candidates = nodes
      .filter((el) => rowOf(el) === curRow)
      .sort((a, b) => colOf(a) - colOf(b));
    const pos = candidates.indexOf(current);
    if (pos >= 0) {
      next = candidates[pos + dir] || null;
    }
    // Fallback: sequential
    if (!next) {
      next = nodes[idx + dir] || null;
    }
  }

  if (!next) return false;

  e.preventDefault();
  e.stopPropagation();
  focusNavTarget(next);
  return true;
}

/**
 * Combined key handler: arrow navigation + optional extra handler (e.g. wheel guards).
 */
export function createInputKeyDown(extraHandler?: (e: any) => void) {
  return (e: any) => {
    if (navigateInputsByArrow(e)) return;
    // Still block bare up/down from spinning number values when not navigating
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
    extraHandler?.(e);
  };
}
