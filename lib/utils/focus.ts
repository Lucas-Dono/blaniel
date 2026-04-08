/**
 * Focus Management Utilities
 * Provides utilities for managing focus, keyboard navigation, and accessibility
 */

/**
 * Focus-visible class names for Tailwind
 * Use these to style elements only when focused via keyboard
 */
export const focusVisibleClasses = {
  /**
   * Primary focus ring (for primary actions, buttons)
   */
  primary:
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',

  /**
   * Secondary focus ring (for secondary actions, links)
   */
  secondary:
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-500 focus-visible:ring-offset-2',

  /**
   * Danger focus ring (for destructive actions)
   */
  danger:
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',

  /**
   * Input focus ring (for form inputs)
   */
  input:
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0',

  /**
   * Minimal focus (for subtle elements)
   */
  minimal:
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600 focus-visible:ring-offset-1',

  /**
   * No ring, just outline (for very constrained spaces)
   */
  outline:
    'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',

  /**
   * Inset ring (for elements with backgrounds)
   */
  inset:
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
};

/**
 * Get all tabbable elements in document or container
 */
export function getTabbableElements(
  container: HTMLElement | Document = document
): HTMLElement[] {
  const selector = [
    'a[href]:not([disabled])',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(', ');

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(selector)
  );

  // Filter out invisible elements
  return elements.filter(el => {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  });
}

/**
 * Get the next tabbable element in the DOM
 */
export function getNextTabbable(
  currentElement: HTMLElement,
  container?: HTMLElement
): HTMLElement | null {
  const tabbableElements = getTabbableElements(container);
  const currentIndex = tabbableElements.indexOf(currentElement);

  if (currentIndex === -1) return null;

  const nextIndex = currentIndex + 1;
  return nextIndex < tabbableElements.length
    ? tabbableElements[nextIndex]
    : null;
}

/**
 * Get the previous tabbable element in the DOM
 */
export function getPreviousTabbable(
  currentElement: HTMLElement,
  container?: HTMLElement
): HTMLElement | null {
  const tabbableElements = getTabbableElements(container);
  const currentIndex = tabbableElements.indexOf(currentElement);

  if (currentIndex === -1) return null;

  const prevIndex = currentIndex - 1;
  return prevIndex >= 0 ? tabbableElements[prevIndex] : null;
}

/**
 * Move focus to next tabbable element
 */
export function focusNext(
  currentElement?: HTMLElement,
  container?: HTMLElement,
  wrap = false
): boolean {
  const current = currentElement || (document.activeElement as HTMLElement);
  if (!current) return false;

  const next = getNextTabbable(current, container);

  if (next) {
    next.focus();
    return true;
  }

  // Wrap to first if requested
  if (wrap) {
    const tabbableElements = getTabbableElements(container);
    if (tabbableElements.length > 0) {
      tabbableElements[0].focus();
      return true;
    }
  }

  return false;
}

/**
 * Move focus to previous tabbable element
 */
export function focusPrevious(
  currentElement?: HTMLElement,
  container?: HTMLElement,
  wrap = false
): boolean {
  const current = currentElement || (document.activeElement as HTMLElement);
  if (!current) return false;

  const prev = getPreviousTabbable(current, container);

  if (prev) {
    prev.focus();
    return true;
  }

  // Wrap to last if requested
  if (wrap) {
    const tabbableElements = getTabbableElements(container);
    if (tabbableElements.length > 0) {
      tabbableElements[tabbableElements.length - 1].focus();
      return true;
    }
  }

  return false;
}

/**
 * Focus first tabbable element in container
 */
export function focusFirst(container?: HTMLElement): boolean {
  const tabbableElements = getTabbableElements(container);
  if (tabbableElements.length > 0) {
    tabbableElements[0].focus();
    return true;
  }
  return false;
}

/**
 * Focus last tabbable element in container
 */
export function focusLast(container?: HTMLElement): boolean {
  const tabbableElements = getTabbableElements(container);
  if (tabbableElements.length > 0) {
    tabbableElements[tabbableElements.length - 1].focus();
    return true;
  }
  return false;
}

/**
 * Check if element is currently focused
 */
export function isFocused(element: HTMLElement): boolean {
  return document.activeElement === element;
}

/**
 * Check if any element inside container is focused
 */
export function containsFocus(container: HTMLElement): boolean {
  return container.contains(document.activeElement);
}

/**
 * Save current focus and return a function to restore it
 */
export function saveFocus(): () => void {
  const previouslyFocused = document.activeElement as HTMLElement;

  return () => {
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
  };
}

/**
 * Disable tabbing for all elements except those in container
 * Returns a cleanup function to restore tabbing
 */
export function lockTabbing(container: HTMLElement): () => void {
  const tabbableOutside = getTabbableElements(document).filter(
    el => !container.contains(el)
  );

  const originalTabIndices = new Map<HTMLElement, string | null>();

  // Disable tabbing for elements outside container
  tabbableOutside.forEach(el => {
    originalTabIndices.set(el, el.getAttribute('tabindex'));
    el.setAttribute('tabindex', '-1');
  });

  // Return cleanup function
  return () => {
    originalTabIndices.forEach((originalValue, el) => {
      if (originalValue === null) {
        el.removeAttribute('tabindex');
      } else {
        el.setAttribute('tabindex', originalValue);
      }
    });
  };
}

/**
 * Scroll element into view if not visible
 * Uses smooth scrolling and respects reduced motion preferences
 */
export function scrollIntoViewIfNeeded(
  element: HTMLElement,
  options?: ScrollIntoViewOptions
): void {
  const rect = element.getBoundingClientRect();
  const isVisible =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;

  if (!isVisible) {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    element.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
      ...options,
    });
  }
}

/**
 * Create a roving tabindex manager for a list of elements
 * Only one element is tabbable at a time (tabindex="0")
 * Others have tabindex="-1"
 */
export function createRovingTabindex(elements: HTMLElement[], initialIndex = 0) {
  let currentIndex = initialIndex;

  const updateTabindices = () => {
    elements.forEach((el, index) => {
      el.setAttribute('tabindex', index === currentIndex ? '0' : '-1');
    });
  };

  const focusCurrent = () => {
    if (elements[currentIndex]) {
      elements[currentIndex].focus();
      scrollIntoViewIfNeeded(elements[currentIndex]);
    }
  };

  const next = () => {
    currentIndex = (currentIndex + 1) % elements.length;
    updateTabindices();
    focusCurrent();
  };

  const previous = () => {
    currentIndex = (currentIndex - 1 + elements.length) % elements.length;
    updateTabindices();
    focusCurrent();
  };

  const first = () => {
    currentIndex = 0;
    updateTabindices();
    focusCurrent();
  };

  const last = () => {
    currentIndex = elements.length - 1;
    updateTabindices();
    focusCurrent();
  };

  const setCurrent = (index: number) => {
    if (index >= 0 && index < elements.length) {
      currentIndex = index;
      updateTabindices();
      focusCurrent();
    }
  };

  // Initialize
  updateTabindices();

  return {
    next,
    previous,
    first,
    last,
    setCurrent,
    getCurrentIndex: () => currentIndex,
  };
}
