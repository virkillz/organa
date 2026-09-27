import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Year or month pill tabs (2023 2024 … / AUG SEP …). */
export function PeriodTabs({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    // flexGrow/flexShrink 0: a horizontal ScrollView in a column otherwise shrinks and clips the pills.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.text, on && { color: colors.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  tab: {
    minWidth: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: colors.primaryDark },
  text: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
});
