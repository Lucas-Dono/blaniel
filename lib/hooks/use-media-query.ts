"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect media query matches
 * Useful for responsive behavior
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener (modern browsers)
    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}

// Convenience hooks for common breakpoints
export const useIsMobile = () => useMediaQuery("(max-width: 768px)");
export const useIsTablet = () => useMediaQuery("(min-width: 768px) and (max-width: 1024px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const usePrefersDark = () => useMediaQuery("(prefers-color-scheme: dark)");
export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
