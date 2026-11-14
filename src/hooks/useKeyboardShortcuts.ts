"use client";

import { useEffect } from "react";

export function useKeyboardShortcuts({
    onCalculateOnly,
    onCalculateAndSave,
    onCopy,
    onHistory,
    isSaving,
}) {
    useEffect(() => {
        const handler = (e) => {
            // Don't trigger if typing in input
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

            // Ctrl+Enter or Cmd+Enter -> Calculate & Save
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                onCalculateAndSave?.();
            }
            // Ctrl+Shift+Enter -> Calculate Only
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
                e.preventDefault();
                onCalculateOnly?.();
            }
            // Ctrl+C -> Copy Total
            else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                e.preventDefault();
                onCopy?.();
            }
            // Ctrl+H -> History
            else if ((e.ctrlKey || e.metaKey) && e.key === "h") {
                e.preventDefault();
                onHistory?.();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onCalculateOnly, onCalculateAndSave, onCopy, onHistory]);
}