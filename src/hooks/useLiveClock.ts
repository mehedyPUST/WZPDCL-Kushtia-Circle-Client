"use client";

import { useState, useEffect } from "react";

/**
 * Live date + time — only set after mount to avoid SSR/client hydration mismatch
 */
export function useLiveClock() {
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setCurrentTime(`${dateStr}  ${timeStr}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return currentTime;
}
