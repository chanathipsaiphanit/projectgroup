import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

// True on phone-sized screens. The web build pre-renders pages without a
// screen size, so this only reports a real value once the page is mounted;
// before that it assumes "narrow" (the pre-rendered layout).
export function useIsNarrow(breakpoint = 640) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return !mounted || width < breakpoint;
}
