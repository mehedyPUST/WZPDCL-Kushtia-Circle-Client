"use client";

/**
 * Prevents mouse-wheel and arrow keys from changing number inputs
 * (common issue on numeric fields)
 */
export function useNumberInputGuards() {
  const handleWheel = (e) => {
    e.preventDefault();
    e.target.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  };

  return { handleWheel, handleKeyDown };
}
