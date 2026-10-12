import { useWindowDimensions } from 'react-native';

/**
 * Both apps also run full-screen in a browser, so every screen asks the viewport how
 * wide it is instead of assuming a phone. Breakpoints match the way the layouts
 * actually change: one column, a card grid, or a centred reading column.
 */
export const BREAKPOINTS = { phone: 480, tablet: 900 };

/** A single column of content stops reading well past this, so it is centred. */
export const MAX_CONTENT = 680;
export const MAX_GRID = 1120;

export function useViewport() {
  const { width, height } = useWindowDimensions();
  const size = width < BREAKPOINTS.phone ? 'phone' : width < BREAKPOINTS.tablet ? 'tablet' : 'desktop';
  return {
    width,
    height,
    size,
    phone: size === 'phone',
    tablet: size === 'tablet',
    desktop: size === 'desktop',
    /** Phones get edge-to-edge cards; wider screens get the gutter back. */
    gutter: size === 'phone' ? 16 : size === 'tablet' ? 28 : 40
  };
}

/** Column count for a card grid that keeps every card at least `min` points wide. */
export function useGrid(min = 320, max = 3) {
  const { width } = useViewport();
  const usable = Math.min(width, MAX_GRID);
  return Math.max(1, Math.min(max, Math.floor(usable / min)));
}
