import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * To support static rendering, return light initially
 * and update the color scheme after client hydration.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setHasHydrated(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return "light";
}