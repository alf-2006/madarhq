import Feather from "@expo/vector-icons/Feather";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SchemeColors } from "@/constants/theme";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/madar/format";
import type { Tone } from "@/lib/madar/labels";

export const C = SchemeColors.light;

export const FONTS = {
  regular: "Cairo_400Regular",
  medium: "Cairo_500Medium",
  semibold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
} as const;

export type Weight = keyof typeof FONTS;
export type IconName = React.ComponentProps<typeof Feather>["name"];

// ------------------------------------------------------------------ text

export function T({
  weight = "regular",
  className,
  style,
  ...props
}: TextProps & { weight?: Weight; className?: string }) {
  return (
    <Text
      {...props}
      className={cn("text-[14px] text-foreground", className)}
      style={[{ fontFamily: FONTS[weight], writingDirection: "rtl" }, style]}
    />
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <T weight="semibold" className={cn("text-[12px] text-muted", className)}>
      {children}
    </T>
  );
}

export function Icon({ name, size = 18, color = C.foreground, style }: { name: IconName; size?: number; color?: string; style?: any }) {
  return <Feather name={name} size={size} color={color} style={style} />;
}

// ------------------------------------------------------------------ layout

export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View className={cn("rounded-2xl border border-border bg-surface p-4", className)} style={style}>
      {children}
    </View>
  );
}

export function Row({ children, className, style }: { children: React.ReactNode; className?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View className={cn("flex-row items-center", className)} style={style}>
      {children}
    </View>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cn("h-px bg-border", className)} />;
}

export function useIsWide(min = 900) {
  const { width } = useWindowDimensions();
  return width >= min;
}

// ------------------------------------------------------------------ buttons

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";

const BUTTON_STYLES: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.primary, fg: "#FFFFFF", border: C.primary },
  secondary: { bg: C.surface, fg: C.foreground, border: C.border },
  ghost: { bg: "transparent", fg: C.foreground, border: "transparent" },
  danger: { bg: C["error-soft"], fg: C.error, border: C["error-soft"] },
  soft: { bg: C["primary-soft"], fg: C.primary, border: C["primary-soft"] },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  size = "md",
  style,
  full,
  label,
  testID,
}: {
  title?: string;
  /** Accessible name; required for icon-only buttons. */
  label?: string;
  testID?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}) {
  const s = BUTTON_STYLES[variant];
  const height = size === "sm" ? 34 : size === "lg" ? 50 : 42;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      testID={testID}
      accessibilityState={{ disabled: !!inactive }}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: title ? (size === "sm" ? 12 : 16) : 0,
          width: title ? undefined : height,
          borderRadius: 12,
          backgroundColor: s.bg,
          borderWidth: 1,
          borderColor: s.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
          alignSelf: full ? "stretch" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={s.fg} />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 15 : 17} color={s.fg} />
      ) : null}
      {title ? (
        <T weight="semibold" style={{ color: s.fg, fontSize: size === "sm" ? 13 : 14 }}>
          {title}
        </T>
      ) : null}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = C.foreground,
  size = 36,
  label,
  badge,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  label?: string;
  badge?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2.8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? C.sand : "transparent",
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: C.error,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <T weight="bold" style={{ color: "#fff", fontSize: 10, lineHeight: 14 }}>
            {badge > 99 ? "99+" : badge}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Tap({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={(state) => {
        const base = typeof style === "function" ? style(state) : style;
        return [base, { opacity: state.pressed ? 0.75 : 1 }];
      }}
    >
      {children}
    </Pressable>
  );
}

// ------------------------------------------------------------------ pills & avatars

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: C.sand, fg: C.muted },
  primary: { bg: C["primary-soft"], fg: C.primary },
  success: { bg: C["primary-soft"], fg: C.success },
  warning: { bg: C["warning-soft"], fg: C.warning },
  error: { bg: C["error-soft"], fg: C.error },
  info: { bg: C["info-soft"], fg: C.info },
};

export function Pill({ label, tone = "neutral", icon, dot }: { label: string; tone?: Tone; icon?: IconName; dot?: boolean }) {
  const t = TONES[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: t.bg,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} /> : null}
      {icon ? <Icon name={icon} size={11} color={t.fg} /> : null}
      <T weight="semibold" style={{ color: t.fg, fontSize: 11.5 }}>
        {label}
      </T>
    </View>
  );
}

export function toneColor(tone: Tone) {
  return TONES[tone].fg;
}

const AVATAR_COLORS = ["#176B52", "#2F6FA3", "#B7791F", "#8E4B9B", "#C2412D", "#3E7C8C", "#6B7F2A", "#5A5F73"];

function hashColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, id, size = 32 }: { name?: string | null; id?: string | null; size?: number }) {
  const color = hashColor(id ?? name ?? "?");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + "22",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: color + "33",
      }}
    >
      <T weight="bold" style={{ color, fontSize: size * 0.36, lineHeight: size * 0.6 }}>
        {initials(name)}
      </T>
    </View>
  );
}

export function AvatarStack({ people, max = 3, size = 26 }: { people: { id: string; full_name: string }[]; max?: number; size?: number }) {
  if (people.length === 0) return <T className="text-[12px] text-muted">غير مسندة</T>;
  const shown = people.slice(0, max);
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginStart: i === 0 ? 0 : -8, borderRadius: size, borderWidth: 2, borderColor: C.surface }}>
          <Avatar id={p.id} name={p.full_name} size={size} />
        </View>
      ))}
      {people.length > max ? (
        <T className="ms-1 text-[11px] text-muted" weight="semibold">
          +{people.length - max}
        </T>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, color = C.primary, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.sand, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

// ------------------------------------------------------------------ states

export function Loading({ label = "جارِ التحميل…" }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-10">
      <ActivityIndicator color={C.primary} />
      <T className="text-muted">{label}</T>
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="items-center justify-center gap-2 px-6 py-10">
      <View
        style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name={icon} size={22} color={C.muted} />
      </View>
      <T weight="semibold" className="mt-1 text-center text-[15px]">
        {title}
      </T>
      {hint ? <T className="max-w-[360px] text-center text-[13px] text-muted">{hint}</T> : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}

export function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View
      style={{ backgroundColor: C["error-soft"], borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" }}
    >
      <Icon name="alert-circle" size={16} color={C.error} style={{ marginTop: 3 }} />
      <T style={{ color: C.error, flex: 1 }} className="text-[13px]">
        {message}
      </T>
    </View>
  );
}

export function InfoBox({ children, tone = "info", icon = "info" }: { children: React.ReactNode; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Icon name={icon} size={16} color={t.fg} style={{ marginTop: 3 }} />
      <View style={{ flex: 1 }}>{typeof children === "string" ? <T style={{ color: t.fg }} className="text-[13px]">{children}</T> : children}</View>
    </View>
  );
}

// ------------------------------------------------------------------ inputs

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <View className="gap-1.5">
      <T weight="semibold" className="text-[13px]">
        {label}
        {required ? <T style={{ color: C.error }}> *</T> : null}
      </T>
      {children}
      {hint ? <T className="text-[12px] text-muted">{hint}</T> : null}
    </View>
  );
}

const inputBase = {
  minHeight: 44,
  borderWidth: 1,
  borderColor: C.border,
  backgroundColor: C.surface,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontFamily: FONTS.regular,
  fontSize: 14,
  color: C.foreground,
  textAlign: "right" as const,
  writingDirection: "rtl" as const,
};

export function Input({ style, multiline, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={C.muted + "AA"}
      {...props}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        inputBase,
        multiline ? { minHeight: 96, textAlignVertical: "top" } : null,
        focused ? { borderColor: C.primary } : null,
        Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
        style,
      ]}
    />
  );
}

/** Logical inline-start offset. React Native Web maps `start` to `left` regardless of the document direction. */
export function insetStart(v: number | `${number}%`) {
  return (Platform.OS === "web" ? { right: v } : { start: v }) as { right?: number | `${number}%`; start?: number | `${number}%` };
}

export function SearchInput({ value, onChangeText, placeholder = "بحث…" }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ position: "relative", flex: 1, minWidth: 180 }}>
      <Input value={value} onChangeText={onChangeText} placeholder={placeholder} style={{ paddingStart: 36 }} />
      <View style={{ position: "absolute", start: 12, top: 0, bottom: 0, justifyContent: "center" }} pointerEvents="none">
        <Icon name="search" size={16} color={C.muted} />
      </View>
    </View>
  );
}

/** Calendar date field. Uses the browser date picker on web and a typed field on native. */
export function DateField({ value, onChange, placeholder = "اختر تاريخًا" }: { value: string | null; onChange: (v: string | null) => void; placeholder?: string }) {
  if (Platform.OS === "web") {
    const props = {
      type: "date",
      value: value ?? "",
      onChange: (e: { target: { value: string } }) => onChange(e.target.value || null),
      style: {
        height: 44,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "0 12px",
        fontFamily: FONTS.regular,
        fontSize: 14,
        color: value ? C.foreground : C.muted,
        background: C.surface,
        width: "100%",
        boxSizing: "border-box",
        direction: "rtl",
      },
    };
    const El = "input" as any;
    return <El {...props} />;
  }
  return (
    <Input
      value={value ?? ""}
      onChangeText={(t) => onChange(/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : t ? t : null)}
      placeholder={`${placeholder} (YYYY-MM-DD)`}
      keyboardType="numbers-and-punctuation"
    />
  );
}

export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  if (Platform.OS === "web") {
    const El = "input" as any;
    return (
      <El
        type="time"
        value={value}
        onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
        style={{
          height: 44,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "0 12px",
          fontFamily: FONTS.regular,
          fontSize: 14,
          color: C.foreground,
          background: C.surface,
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    );
  }
  return <Input value={value} onChangeText={onChange} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />;
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: V; label: string; icon?: IconName }[];
  value: V;
  onChange: (v: V) => void;
  size?: "sm" | "md";
}) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.sand, borderRadius: 12, padding: 3, gap: 2, alignSelf: "flex-start", flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: size === "sm" ? 10 : 12,
              height: size === "sm" ? 30 : 34,
              borderRadius: 10,
              backgroundColor: active ? C.surface : "transparent",
              ...(active ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } : null),
            }}
          >
            {o.icon ? <Icon name={o.icon} size={14} color={active ? C.primary : C.muted} /> : null}
            <T weight={active ? "semibold" : "medium"} style={{ fontSize: 13, color: active ? C.foreground : C.muted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, icon, color }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? C.primary : C.border,
        backgroundColor: active ? C["primary-soft"] : pressed ? C.sand : C.surface,
      })}
    >
      {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
      {icon ? <Icon name={icon} size={13} color={active ? C.primary : C.muted} /> : null}
      <T weight={active ? "semibold" : "medium"} style={{ fontSize: 12.5, color: active ? C.primary : C.foreground }}>
        {label}
      </T>
    </Pressable>
  );
}

// ------------------------------------------------------------------ sheet

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = screenW >= 720;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,46,36,0.38)",
          justifyContent: wide ? "center" : "flex-end",
          alignItems: "center",
          padding: wide ? 24 : 0,
        }}
      >
        <Pressable style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} onPress={onClose} accessibilityLabel="إغلاق" />
        <View
          style={{
            width: wide ? Math.min(width, screenW - 48) : "100%",
            maxHeight: wide ? screenH - 48 : screenH * 0.92,
            backgroundColor: C.background,
            borderRadius: wide ? 20 : 0,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: "hidden",
            direction: "rtl",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="bold" className="text-[18px]">
                {title}
              </T>
              {subtitle ? <T className="text-[13px] text-muted">{subtitle}</T> : null}
            </View>
            <IconButton icon="x" onPress={onClose} label="إغلاق" color={C.muted} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: footer ? 12 : 24 + insets.bottom, gap: 14 }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 16 + (wide ? 0 : insets.bottom),
                borderTopWidth: 1,
                borderTopColor: C.border,
                backgroundColor: C.surface,
                justifyContent: "flex-start",
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------ select

export type Option<V extends string = string> = { value: V; label: string; hint?: string; color?: string };

export function Select<V extends string>({
  value,
  onChange,
  options,
  placeholder = "اختر",
  title,
  noneLabel,
  disabled,
}: {
  value: V | null;
  onChange: (v: V | null) => void;
  options: Option<V>[];
  placeholder?: string;
  title?: string;
  noneLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => (query ? options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(query.toLowerCase())) : options),
    [options, query],
  );
  return (
    <>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        style={{ ...inputBase, flexDirection: "row", alignItems: "center", gap: 8, opacity: disabled ? 0.6 : 1 }}
      >
        {selected?.color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selected.color }} /> : null}
        <T style={{ flex: 1, color: selected ? C.foreground : C.muted + "AA" }} numberOfLines={1}>
          {selected ? selected.label : value === null && noneLabel ? noneLabel : placeholder}
        </T>
        {!disabled ? <Icon name="chevron-down" size={16} color={C.muted} /> : null}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title ?? placeholder} width={460}>
        {options.length > 8 ? <SearchInput value={query} onChangeText={setQuery} /> : null}
        <View style={{ gap: 4 }}>
          {noneLabel ? (
            <OptionRow
              label={noneLabel}
              active={value === null}
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            />
          ) : null}
          {filtered.map((o) => (
            <OptionRow
              key={o.value}
              label={o.label}
              hint={o.hint}
              color={o.color}
              active={o.value === value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
                setQuery("");
              }}
            />
          ))}
          {filtered.length === 0 ? <T className="py-4 text-center text-muted">لا توجد نتائج</T> : null}
        </View>
      </Sheet>
    </>
  );
}

function OptionRow({ label, hint, color, active, onPress, multi }: { label: string; hint?: string; color?: string; active: boolean; onPress: () => void; multi?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: active ? C["primary-soft"] : pressed ? C.sand : "transparent",
      })}
    >
      {multi ? (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: active ? C.primary : C.border,
            backgroundColor: active ? C.primary : C.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {active ? <Icon name="check" size={13} color="#fff" /> : null}
        </View>
      ) : null}
      {color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /> : null}
      <View style={{ flex: 1 }}>
        <T weight={active ? "semibold" : "regular"}>{label}</T>
        {hint ? <T className="text-[12px] text-muted">{hint}</T> : null}
      </View>
      {!multi && active ? <Icon name="check" size={16} color={C.primary} /> : null}
    </Pressable>
  );
}

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "اختر",
  title,
  renderValue,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  placeholder?: string;
  title?: string;
  renderValue?: (selected: Option[]) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.filter((o) => values.includes(o.value));
  const filtered = query ? options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ ...inputBase, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          {selected.length === 0 ? (
            <T style={{ color: C.muted + "AA" }}>{placeholder}</T>
          ) : renderValue ? (
            renderValue(selected)
          ) : (
            <T numberOfLines={1}>{selected.map((s) => s.label).join("، ")}</T>
          )}
        </View>
        <Icon name="chevron-down" size={16} color={C.muted} />
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title ?? placeholder}
        width={460}
        footer={<Button title={`تم (${values.length})`} onPress={() => setOpen(false)} />}
      >
        {options.length > 8 ? <SearchInput value={query} onChangeText={setQuery} /> : null}
        <View style={{ gap: 4 }}>
          {filtered.map((o) => {
            const active = values.includes(o.value);
            return (
              <OptionRow
                key={o.value}
                multi
                label={o.label}
                hint={o.hint}
                active={active}
                onPress={() => onChange(active ? values.filter((v) => v !== o.value) : [...values, o.value])}
              />
            );
          })}
          {filtered.length === 0 ? <T className="py-4 text-center text-muted">لا توجد نتائج</T> : null}
        </View>
      </Sheet>
    </>
  );
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: string[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {colors.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: c,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: value === c ? 3 : 0,
            borderColor: C.surface,
            ...(value === c ? { shadowColor: c, shadowOpacity: 0.6, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, outlineWidth: 2, outlineColor: c, outlineStyle: "solid" } : null),
          } as any}
        >
          {value === c ? <Icon name="check" size={15} color="#fff" /> : null}
        </Pressable>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ toast & confirm

type ToastItem = { id: number; message: string; tone: "success" | "error" | "info" };
type ToastApi = { show: (message: string, tone?: ToastItem["tone"]) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();
  const show = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tone === "error" ? 5200 : 3200);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: insets.top + 12, left: 0, right: 0, alignItems: "center", gap: 8, zIndex: 9999 }}
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const icon: IconName = item.tone === "error" ? "alert-circle" : item.tone === "info" ? "info" : "check-circle";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        maxWidth: 440,
        marginHorizontal: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: C.forest,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Icon name={icon} size={16} color={item.tone === "error" ? "#F3A493" : item.tone === "info" ? "#9CC3E6" : "#8FD3B6"} />
      <T style={{ color: "#F4F1EA", flexShrink: 1 }} className="text-[13px]" weight="medium">
        {item.message}
      </T>
    </View>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function confirmAction(message: string, confirmLabel = "تأكيد"): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(message) : false);
  }
  return new Promise((resolve) => {
    Alert.alert("تأكيد", message, [
      { text: "إلغاء", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/** Ticks every second while mounted; used for running timers. */
export function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, active]);
  return now;
}
