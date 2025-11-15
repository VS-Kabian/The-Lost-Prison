import { useCallback, useRef } from 'react';

/**
 * Hook that provides a debounced function
 * Useful for preventing rapid successive calls (e.g., save operations)
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 1000ms)
 * @returns Debounced version of the callback
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1000
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}
