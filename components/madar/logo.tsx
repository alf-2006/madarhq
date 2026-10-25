import Svg, { Circle, Path, Rect } from "react-native-svg";
import { View } from "react-native";
import { C, T } from "./ui";

/** Open orbital ring with a square progress marker. */
export function LogoMark({ size = 36, color = C.primary, marker = C.warning }: { size?: number; color?: string; marker?: string }) {
  // Ring: centre (24,24), radius 16, open gap at the upper-left where the marker sits.
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M 34.3 11.7 A 16 16 0 1 1 13.7 11.7"
        stroke={color}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={24} cy={24} r={4.2} fill={color} />
      <Rect x={20.2} y={4.2} width={7.6} height={7.6} rx={1.6} fill={marker} transform="rotate(45 24 8)" />
    </Svg>
  );
}

export function Wordmark({ light, size = 22 }: { light?: boolean; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <LogoMark size={size + 12} color={light ? "#8FD3B6" : C.primary} />
      <T weight="bold" style={{ fontSize: size, color: light ? "#F4F1EA" : C.foreground, lineHeight: size * 1.5 }}>
        مدار
      </T>
    </View>
  );
}

/** Decorative orbit outlines for the forest welcome panels. */
export function OrbitDecor({ size = 320, opacity = 0.14 }: { size?: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320" style={{ position: "absolute", left: -size * 0.28, top: -size * 0.3 }} pointerEvents="none">
      <Circle cx={160} cy={160} r={150} stroke="#FFFFFF" strokeOpacity={opacity} strokeWidth={1.2} fill="none" />
      <Circle cx={160} cy={160} r={110} stroke="#FFFFFF" strokeOpacity={opacity * 1.2} strokeWidth={1.2} fill="none" />
      <Circle cx={160} cy={160} r={70} stroke="#FFFFFF" strokeOpacity={opacity * 1.4} strokeWidth={1.2} fill="none" />
      <Rect x={262} y={64} width={10} height={10} rx={2} fill="#E0A443" fillOpacity={0.8} transform="rotate(45 267 69)" />
      <Circle cx={88} cy={262} r={4} fill="#8FD3B6" fillOpacity={0.7} />
    </Svg>
  );
}
