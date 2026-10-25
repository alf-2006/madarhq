type Swatch = { light: string; dark: string };
export const themeColors: {
  primary: Swatch;
  "primary-soft": Swatch;
  forest: Swatch;
  background: Swatch;
  surface: Swatch;
  sand: Swatch;
  foreground: Swatch;
  muted: Swatch;
  border: Swatch;
  success: Swatch;
  warning: Swatch;
  "warning-soft": Swatch;
  error: Swatch;
  "error-soft": Swatch;
  info: Swatch;
  "info-soft": Swatch;
};
declare const themeConfig: {
  themeColors: typeof themeColors;
};
export default themeConfig;
