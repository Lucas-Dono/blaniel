"use client";

import { useEffect } from "react";

interface KeyboardShortcutOptions {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  enabled?: boolean;
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcut(
  options: KeyboardShortcutOptions,
  callback: () => void
) {
  const {
    key,
    ctrl = false,
    shift = false,
    alt = false,
    meta = false,
    enabled = true
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesCtrl = ctrl ? event.ctrlKey : !event.ctrlKey;
      const matchesShift = shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = alt ? event.altKey : !event.altKey;
      const matchesMeta = meta ? event.metaKey : !event.metaKey;

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt && matchesMeta) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, ctrl, shift, alt, meta, enabled, callback]);
}

// Common shortcuts
export const useCtrlK = (callback: () => void, enabled = true) => {
  useKeyboardShortcut({ key: "k", ctrl: true, enabled }, callback);
};

export const useEscape = (callback: () => void, enabled = true) => {
  useKeyboardShortcut({ key: "Escape", enabled }, callback);
};

export const useCtrlS = (callback: () => void, enabled = true) => {
  useKeyboardShortcut({ key: "s", ctrl: true, enabled }, callback);
};
