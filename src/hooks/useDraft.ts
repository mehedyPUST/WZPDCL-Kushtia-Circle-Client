"use client";

import { useState, useEffect, useCallback } from "react";
import { createInitialAmps } from "@/lib/calculations";

const DRAFT_KEY = "wzpdcl_calculator_draft";

export function useDraft() {
    const [draft, setDraft] = useState(() => {
        if (typeof window === "undefined") return null;
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.busVoltages && parsed.amps) return parsed;
            }
        } catch {
            // Silent fail
        }
        return null;
    });
    const [loaded] = useState(true);

    // Save draft with debounce
    const saveDraft = useCallback((busVoltages, amps) => {
        try {
            const draftData = { busVoltages, amps, savedAt: new Date().toISOString() };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
            setDraft(draftData);
        } catch {
            // Silent fail
        }
    }, []);

    // Clear draft
    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(DRAFT_KEY);
            setDraft(null);
        } catch {
            // Silent fail
        }
    }, []);

    // Check if draft exists and is recent (within 24 hours)
    const hasValidDraft = useCallback(() => {
        if (!draft?.savedAt) return false;
        const saved = new Date(draft.savedAt);
        const now = new Date();
        const diff = now - saved;
        return diff < 24 * 60 * 60 * 1000; // 24 hours
    }, [draft]);

    return { draft, loaded, saveDraft, clearDraft, hasValidDraft };
}