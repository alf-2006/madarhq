import { createContext, useContext, useEffect, useMemo } from "react";
import { View } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = { colorScheme: ColorScheme };

const ThemeContext = createContext<ThemeContextValue>({ colorScheme: "light" });

// Madar ships a single warm light theme; the palette is applied as CSS variables on web
// and NativeWind variables on native so `bg-primary` etc. resolve everywhere.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme: ColorScheme = "light";
  const palette = SchemeColors[colorScheme];

  useEffect(() => {
    try {
      nativewindColorScheme.set(colorScheme);
    } catch {
      // ignore: unsupported on some platforms
    }
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = colorScheme;
      root.lang = "ar";
      root.dir = "rtl";
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, [palette]);

  const themeVariables = useMemo(
    () =>
      vars(
        Object.fromEntries(Object.entries(palette).map(([token, value]) => [`color-${token}`, value])),
      ),
    [palette],
  );

  return (
    <ThemeContext.Provider value={{ colorScheme }}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}
