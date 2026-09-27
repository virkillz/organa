import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { Text } from './text';

type IconName = keyof typeof Ionicons.glyphMap;

/** White card with the thick coloured border used throughout the designs. */
export function Card({
  children,
  tone = 'primary',
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  tone?: 'primary' | 'warning' | 'navy' | 'danger' | 'plain';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const border = { primary: colors.primary, warning: colors.warning, navy: colors.navy, danger: colors.danger, plain: colors.line }[tone];
  if (!onPress) return <View style={[styles.card, { borderColor: border }, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderColor: border }, style, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

/** Round icon + label + value, as in the stock dashboard KPI cards. */
export function Kpi({ icon, iconBg, label, value }: { icon: IconName; iconBg: string; label: string; value: string }) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={colors.white} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </View>
  );
}

/** Square category tile with an optional count badge. */
export function Tile({
  icon,
  label,
  badge,
  badgeTone = 'navy',
  onPress,
  dashed,
}: {
  icon: IconName;
  label: string;
  badge?: number;
  badgeTone?: 'navy' | 'danger' | 'warning';
  onPress: () => void;
  dashed?: boolean;
}) {
  const badgeBg = { navy: colors.navy, danger: colors.danger, warning: colors.warning }[badgeTone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, dashed && styles.tileDashed, pressed && { opacity: 0.8 }]}>
      <View>
        <Ionicons name={icon} size={34} color={colors.primary} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Three tiles per row; a short last row keeps its tiles left-aligned. */
export function TileGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, i) => (
        <View key={i} style={styles.tileRow}>
          {[0, 1, 2].map((j) => (
            <View key={j} style={{ flex: 1 }}>
              {row[j] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Green gradient-style action button (FAB in the designs). */
export function Fab({ label, icon, onPress, style }: { label?: string; icon?: IconName; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Tambah'}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }, style]}>
      {icon ? <Ionicons name={icon} size={26} color={colors.white} /> : null}
      {label ? (
        <Text style={styles.fabText} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Filled light-green input with a label above (stock and HPP forms). */
export function BoxField({
  label,
  error,
  prefix,
  suffix,
  style,
  ...input
}: TextInputProps & { label?: string; error?: string; prefix?: string; suffix?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 4 }, style]}>
      {label ? <Text style={styles.boxLabel}>{label}</Text> : null}
      <View style={[styles.box, error && { borderColor: colors.danger }]}>
        {prefix ? <Text style={styles.boxAffix}>{prefix}</Text> : null}
        <TextInput placeholderTextColor={colors.muted} style={styles.boxInput} {...input} />
        {suffix ? <Text style={styles.boxAffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

/** Pressable box that looks like BoxField, for pickers (select, date). */
export function BoxButton({ label, value, placeholder, onPress, error, style }: { label?: string; value?: string; placeholder?: string; onPress: () => void; error?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 4 }, style]}>
      {label ? <Text style={styles.boxLabel}>{label}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} ${value ?? placeholder ?? ''}`} onPress={onPress} style={[styles.box, styles.boxWhite, error && { borderColor: colors.danger }]}>
        <Text style={[styles.boxInput, !value && { color: colors.muted }]} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Ionicons name="caret-down" size={16} color={colors.navy} />
      </Pressable>
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

/** Filter bar under the title: dropdown label on the left, action icons on the right. */
export function Toolbar({ filter, onFilter, actions }: { filter?: string; onFilter?: () => void; actions?: { icon: IconName; label: string; onPress: () => void; active?: boolean }[] }) {
  return (
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" disabled={!onFilter} onPress={onFilter} style={styles.toolbarFilter}>
        <Text style={styles.toolbarText} numberOfLines={1}>
          {filter}
        </Text>
        {onFilter ? <Ionicons name="chevron-down" size={14} color={colors.navy} /> : null}
      </Pressable>
      {actions?.map((a) => (
        <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} style={[styles.toolbarAction, a.active && { backgroundColor: colors.surfaceTint }]}>
          <Ionicons name={a.icon} size={22} color={colors.navy} />
        </Pressable>
      ))}
    </View>
  );
}

export function Loading() {
  return <ActivityIndicator style={{ marginTop: space.xl }} color={colors.primary} />;
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Pressable onPress={onRetry} style={{ padding: space.lg, alignItems: 'center', gap: space.sm }}>
      <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
      <Text style={{ textAlign: 'center', color: colors.navy }}>{error.message}</Text>
      {onRetry ? <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>Coba lagi</Text> : null}
    </Pressable>
  );
}

export function Empty({ icon = 'file-tray-outline', title, body }: { icon?: IconName; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={40} color={colors.primaryTint} />
      <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>{body}</Text> : null}
    </View>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warning' | 'danger' | 'navy' }) {
  const bg = { ok: colors.successBg, warning: '#FDE2D2', danger: colors.dangerBg, navy: '#DADBE8' }[tone];
  const fg = { ok: colors.primaryDark, warning: colors.warning, danger: colors.danger, navy: colors.navy }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: fg }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2.5,
    padding: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  kpi: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  kpiIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.navy },
  kpiValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  tileRow: { flexDirection: 'row', gap: space.md },
  tile: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  tileDashed: { borderStyle: 'dashed', borderColor: colors.primaryTint },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 12, textAlign: 'center', color: colors.ink },
  badge: { position: 'absolute', right: -14, bottom: -4, minWidth: 22, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: colors.white },
  fab: {
    minHeight: 54,
    minWidth: 76,
    maxWidth: 160,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white, textAlign: 'center', fontStyle: 'italic' },
  boxLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
  box: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryTint,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: space.sm + 4,
  },
  boxWhite: { backgroundColor: colors.white, borderColor: colors.line },
  boxInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  boxAffix: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  toolbar: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white, minHeight: 50 },
  toolbarFilter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md },
  toolbarText: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, flexShrink: 1 },
  toolbarAction: { width: 52, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.line },
});
