import { useState, useEffect } from "react";

interface MobileDetectionState {
  isMobile: boolean;
  isLandscape: boolean;
  isMobileLandscape: boolean;
}

/**
 * Hook to detect mobile devices and orientation
 * Returns true for mobile landscape only when device is a phone in landscape mode
 */
export function useMobileDetection(): MobileDetectionState {
  const [state, setState] = useState<MobileDetectionState>(() => {
    const isMobile = detectMobile();
    const isLandscape = detectLandscape();
    return {
      isMobile,
      isLandscape,
      isMobileLandscape: isMobile && isLandscape,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const isMobile = detectMobile();
      const isLandscape = detectLandscape();
      setState({
        isMobile,
        isLandscape,
        isMobileLandscape: isMobile && isLandscape,
      });
    };

    // Listen for both resize and orientation change events
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return state;
}

/**
 * Detects if device is a mobile phone
 * Uses user agent and screen size as indicators
 */
function detectMobile(): boolean {
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA =
    /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );

  // Check screen size - mobile phones typically have max width of 900px
  const isMobileSize = window.innerWidth <= 900;

  // Also check for touch support
  const hasTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // Consider it mobile if UA matches OR (small size AND touch support)
  return isMobileUA || (isMobileSize && hasTouch);
}

/**
 * Detects if device is in landscape orientation
 */
function detectLandscape(): boolean {
  // Primary check: width > height
  const isLandscapeSize = window.innerWidth > window.innerHeight;

  // Secondary check: screen orientation API (if available)
  const isLandscapeOrientation =
    window.screen?.orientation?.type?.includes("landscape") ?? false;

  // Use orientation API if available, otherwise fall back to size comparison
  return window.screen?.orientation
    ? isLandscapeOrientation
    : isLandscapeSize;
}
