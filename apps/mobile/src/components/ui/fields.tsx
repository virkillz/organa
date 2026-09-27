import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { Text } from './text';

/** Auth-style input: placeholder only, underline, optional trailing element (e.g. "Lupa password?"). */
export function UnderlineField({
  error,
  trailing,
  secure,
  ...input
}: TextInputProps & { error?: string; trailing?: ReactNode; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.fieldWrap}>
      <View style={[styles.underlineRow, error && styles.underlineError]}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={styles.underlineInput}
          secureTextEntry={secure && hidden}
          autoCapitalize="none"
          {...input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Tampilkan password' : 'Sembunyikan password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
        {trailing}
      </View>
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

/** Setup-style input: green label above the value, underline below. */
export function LabeledField({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.labeledInput, error && styles.underlineError]}
        {...input}
      />
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Pilih',
  error,
  tone = 'default',
}: {
  label: string;
  value: T | null | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  /** `onPrimary` renders white text for use on the green drawer. */
  tone?: 'default' | 'onPrimary';
}) {
  const [open, setOpen] = useState(false);
  const onPrimary = tone === 'onPrimary';
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.fieldWrap}>
      {onPrimary ? null : <Text variant="label">{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={[styles.selectRow, onPrimary && styles.selectRowOnPrimary, error && styles.underlineError]}>
        <Text style={[styles.selectValue, !selected && { color: colors.muted }, onPrimary && styles.onPrimaryText]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name={onPrimary ? 'chevron-down' : 'caret-down'} size={16} color={onPrimary ? colors.white : colors.primary} />
      </Pressable>
      {error ? <Text variant="error">{error}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text variant="heading" style={{ marginBottom: space.sm }}>
              {label}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}>
                  <Text variant={item.value === value ? 'bodyStrong' : 'body'}>{item.label}</Text>
                  {item.value === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      {icon}
      <Text style={[styles.chipLabel, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { gap: 4 },
  underlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  underlineError: { borderBottomColor: colors.danger },
  underlineInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 12, color: colors.ink },
  labeledInput: {
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingVertical: 8,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  selectValue: { fontFamily: fonts.medium, fontSize: 15 },
  selectRowOnPrimary: { borderBottomWidth: 0, paddingVertical: 8 },
  onPrimaryText: { fontFamily: fonts.regular, fontSize: 13, color: colors.white },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
    maxHeight: '60%',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
});
