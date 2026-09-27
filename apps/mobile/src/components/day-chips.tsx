import { WEEKDAY_SHORT_ID, type Weekday } from '@organa/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, fonts, radius } from '@/theme/tokens';

const FULL_NAMES: Record<Weekday, string> = {
  MON: 'Senin', TUE: 'Selasa', WED: 'Rabu', THU: 'Kamis', FRI: 'Jumat', SAT: 'Sabtu', SUN: 'Minggu',
};

export function DayChips({
  days,
  value,
  onChange,
}: {
  days: readonly Weekday[];
  value: Weekday[];
  onChange: (value: Weekday[]) => void;
}) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const on = value.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={FULL_NAMES[day]}
            onPress={() => onChange(on ? value.filter((d) => d !== day) : days.filter((d) => d === day || value.includes(d)))}
            style={[styles.chip, on && styles.on]}>
            <Text style={styles.label}>{WEEKDAY_SHORT_ID[day]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.primaryLight },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
