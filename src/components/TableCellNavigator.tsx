"use client";

import { useEffect, useRef } from "react";

/**
 * Universal Table Cell Navigation & Highlighting.
 * 
 * Behavior:
 * - Clicking any cell in any table highlights the cell.
 * - Single click does NOT make fields editable (blurs inputs / prevents editing mode).
 * - Navigation keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, Tab)
 *   change the selected cell up, down, right, and left.
 * - Keeps selected cells smoothly in view within scrollable containers.
 * - Double-clicking an editable cell allows focusing its input if desired.
 * - Pressing Escape clears the selection.
 */
export default function TableCellNavigator() {
  const selectedCellRef = useRef<HTMLElement | null>(null);
  const selectedTableRef = useRef<HTMLTableElement | null>(null);
  const preferredCenterXRef = useRef<number | null>(null);

  useEffect(() => {
    // Helper to get visible rows in a table
    const getVisibleRows = (table: HTMLTableElement): HTMLTableRowElement[] => {
      return Array.from(table.querySelectorAll("tr")).filter((tr) => {
        if (tr.offsetParent === null && tr.clientHeight === 0) return false;
        try {
          const style = window.getComputedStyle(tr);
          return style.display !== "none" && style.visibility !== "hidden";
        } catch {
          return true;
        }
      });
    };

    // Helper to get visible cells in a row
    const getVisibleCells = (tr: HTMLTableRowElement): HTMLElement[] => {
      return Array.from(tr.querySelectorAll("td, th")).filter((c) => {
        if (
          (c as HTMLElement).offsetParent === null &&
          (c as HTMLElement).clientWidth === 0
        ) {
          return false;
        }
        try {
          const style = window.getComputedStyle(c);
          return style.display !== "none" && style.visibility !== "hidden";
        } catch {
          return true;
        }
      }) as HTMLElement[];
    };

    // Clear all highlighted cells
    const clearHighlight = () => {
      if (selectedCellRef.current) {
        selectedCellRef.current.removeAttribute("data-cell-selected");
        selectedCellRef.current.classList.remove("table-cell-highlighted");
        selectedCellRef.current = null;
      }
      const existing = document.querySelectorAll('[data-cell-selected="true"]');
      existing.forEach((el) => {
        el.removeAttribute("data-cell-selected");
        el.classList.remove("table-cell-highlighted");
      });
      selectedTableRef.current = null;
      preferredCenterXRef.current = null;
    };

    // Apply highlight to a specific cell
    const highlightCell = (
      cell: HTMLElement,
      table: HTMLTableElement,
      options: { scroll?: boolean; updateCenterX?: boolean } = {
        scroll: true,
        updateCenterX: true,
      }
    ) => {
      if (!cell || !table) return;

      // Remove from any previously highlighted cell
      const prev = document.querySelectorAll('[data-cell-selected="true"]');
      prev.forEach((el) => {
        if (el !== cell) {
          el.removeAttribute("data-cell-selected");
          el.classList.remove("table-cell-highlighted");
        }
      });

      cell.setAttribute("data-cell-selected", "true");
      cell.classList.add("table-cell-highlighted");

      selectedCellRef.current = cell;
      selectedTableRef.current = table;

      if (options.updateCenterX !== false) {
        try {
          const rect = cell.getBoundingClientRect();
          preferredCenterXRef.current = rect.left + rect.width / 2;
        } catch {
          preferredCenterXRef.current = null;
        }
      }

      // Ensure cell is focusable
      if (!cell.hasAttribute("tabindex")) {
        cell.setAttribute("tabindex", "-1");
      }

      // Keep cell in view if table or window is scrollable
      if (options.scroll !== false) {
        try {
          cell.scrollIntoView({
            behavior: "auto",
            block: "nearest",
            inline: "nearest",
          });
        } catch {
          /* ignore */
        }
      }
    };

    // Find next cell based on direction
    const getNextCell = (
      currentCell: HTMLElement,
      table: HTMLTableElement,
      dir: "up" | "down" | "left" | "right" | "home" | "end"
    ): HTMLElement | null => {
      const allRows = getVisibleRows(table);
      const currentRow = currentCell.closest("tr");
      if (!currentRow) return null;

      const currentRowIdx = allRows.indexOf(currentRow);
      if (currentRowIdx === -1) return null;

      const currentCells = getVisibleCells(currentRow);
      const currentColIdx = currentCells.indexOf(currentCell);
      if (currentColIdx === -1) return null;

      if (dir === "left") {
        if (currentColIdx > 0) {
          return currentCells[currentColIdx - 1];
        }
        // At beginning of row: move to last cell of previous row if exists
        if (currentRowIdx > 0) {
          const prevRowCells = getVisibleCells(allRows[currentRowIdx - 1]);
          return prevRowCells[prevRowCells.length - 1] || null;
        }
        return null;
      }

      if (dir === "right") {
        if (currentColIdx < currentCells.length - 1) {
          return currentCells[currentColIdx + 1];
        }
        // At end of row: move to first cell of next row if exists
        if (currentRowIdx < allRows.length - 1) {
          const nextRowCells = getVisibleCells(allRows[currentRowIdx + 1]);
          return nextRowCells[0] || null;
        }
        return null;
      }

      if (dir === "home") {
        return currentCells[0] || null;
      }

      if (dir === "end") {
        return currentCells[currentCells.length - 1] || null;
      }

      if (dir === "up" || dir === "down") {
        const targetRowIdx =
          dir === "up" ? currentRowIdx - 1 : currentRowIdx + 1;
        if (targetRowIdx < 0 || targetRowIdx >= allRows.length) return null;

        const targetRow = allRows[targetRowIdx];
        const targetCells = getVisibleCells(targetRow);
        if (!targetCells.length) return null;

        // Preferred horizontal position
        let targetCenter = preferredCenterXRef.current;
        if (targetCenter == null || !Number.isFinite(targetCenter)) {
          const curRect = currentCell.getBoundingClientRect();
          targetCenter = curRect.left + curRect.width / 2;
        }

        // Geometric match: find cell whose horizontal range contains targetCenter,
        // or has the closest center
        let bestCell = targetCells[0];
        let minDistance = Infinity;

        for (const c of targetCells) {
          const r = c.getBoundingClientRect();
          if (targetCenter >= r.left && targetCenter <= r.right) {
            return c;
          }
          const cCenter = r.left + r.width / 2;
          const dist = Math.abs(targetCenter - cCenter);
          if (dist < minDistance) {
            minDistance = dist;
            bestCell = c;
          }
        }

        return bestCell;
      }

      return null;
    };

    // Intercept mousedown on table cells to prevent input focus/cursor on single click
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const cell = target.closest("td, th") as HTMLElement | null;
      const table = cell?.closest("table");

      if (!cell || !table) {
        // Click was outside any table cell
        // Don't clear if clicking on controls or menus marked with data-no-clear
        if (!target.closest("[data-no-clear-selection]")) {
          clearHighlight();
        }
        return;
      }

      // If clicked on an input or cell containing an input:
      // Single click should NOT make it editable; it should just highlight!
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";

      // If single click, prevent default focusing so text cursor/editing doesn't start
      if (e.detail <= 1) {
        if (isInput) {
          e.preventDefault();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
        highlightCell(cell, table, { scroll: false, updateCenterX: true });
      } else if (e.detail >= 2 && isInput) {
        // Double click on an input: allow user to edit
        (target as HTMLElement).focus();
      }
    };

    // Also handle click event
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const cell = target.closest("td, th") as HTMLElement | null;
      const table = cell?.closest("table");

      if (cell && table) {
        // Single click: ensure blur on inputs so field is not editable
        if (e.detail <= 1) {
          if (
            document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement
          ) {
            document.activeElement.blur();
          }
        }
        highlightCell(cell, table, { scroll: false, updateCenterX: true });
      }
    };

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentCell = selectedCellRef.current;
      const currentTable = selectedTableRef.current;

      if (!currentCell || !currentTable) return;

      // Check if current cell is still connected to the DOM
      if (!currentCell.isConnected) {
        clearHighlight();
        return;
      }

      // If user is actively typing in an input elsewhere (e.g. search, modal, or double-clicked input)
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      ) {
        // If inside an input and pressed Escape, exit input and reselect the cell
        if (e.key === "Escape") {
          (activeEl as HTMLElement).blur();
          highlightCell(currentCell, currentTable);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        clearHighlight();
        return;
      }

      let dir: "up" | "down" | "left" | "right" | "home" | "end" | null = null;
      if (e.key === "ArrowUp") dir = "up";
      else if (e.key === "ArrowDown") dir = "down";
      else if (e.key === "ArrowLeft") dir = "left";
      else if (e.key === "ArrowRight") dir = "right";
      else if (e.key === "Home") dir = "home";
      else if (e.key === "End") dir = "end";
      else if (e.key === "Tab") {
        dir = e.shiftKey ? "left" : "right";
      }

      if (!dir) return;

      // Consume navigation key so page doesn't scroll randomly
      e.preventDefault();
      e.stopPropagation();

      const nextCell = getNextCell(currentCell, currentTable, dir);
      if (nextCell) {
        // If moving vertically (up/down), preserve preferredCenterX; if left/right, update it
        const updateCenter = dir === "left" || dir === "right" || dir === "home" || dir === "end";
        highlightCell(nextCell, currentTable, {
          scroll: true,
          updateCenterX: updateCenter,
        });

        // Ensure no input gets focused — field stays highlighted, NOT editable
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement !== nextCell
        ) {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}
