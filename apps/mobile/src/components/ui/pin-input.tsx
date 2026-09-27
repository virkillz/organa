import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';
import { Text } from './text';

const LENGTH = 6;

/** Six boxes over one hidden input, so paste and OS autofill still work. */
export function PinInput({
  value,
  onChange,
  onComplete,
  secure = true,
  error = false,
  accessibilityLabel = 'Kode unik 6 digit',
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  secure?: boolean;
  error?: boolean;
  accessibilityLabel?: string;
}) {
  const input = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel={accessibilityLabel}>
      <View style={styles.row}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const char = value[i];
          const active = i === Math.min(value.length, LENGTH - 1);
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, error && styles.boxError]}>
              <Text style={styles.char}>{char ? (secure ? '•' : char) : ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, LENGTH);
          onChange(digits);
          if (digits.length === LENGTH) onComplete?.(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxActive: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  char: { fontFamily: fonts.semibold, fontSize: 22 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
