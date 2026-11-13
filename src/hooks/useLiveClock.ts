"use client";

import { useState, useEffect } from "react";

function computeClockParts() {
  const now = new Date();
  const dateFull = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateShort = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return {
    dateFull,
    dateShort,
    time,
    combined: `${dateFull}  ${time}`,
  };
}

/**
 * Live date + time — only set after mount to avoid SSR/client hydration mismatch
 */
export function useLiveClock() {
  const [currentTime, setCurrentTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setCurrentTime(computeClockParts().combined);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return currentTime;
}

export function useLiveClockParts() {
  const [parts, setParts] = useState<{
    dateFull: string;
    dateShort: string;
    time: string;
  } | null>(null);

  useEffect(() => {
    const update = () => {
      const { dateFull, dateShort, time } = computeClockParts();
      setParts({ dateFull, dateShort, time });
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return parts;
}
