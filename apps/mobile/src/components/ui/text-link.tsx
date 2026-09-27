import { Pressable, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { Text } from './text';

/** "Prompt? Action" line with a real touch target on the action (inline <Link> text is too small to tap). */
export function TextLink({
  prompt,
  action,
  onPress,
  tone = 'default',
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  tone?: 'default' | 'onPrimary';
}) {
  const onPrimary = tone === 'onPrimary';
  const promptStyle: StyleProp<TextStyle> = [styles.prompt, onPrimary && { color: colors.white }];
  return (
    <View style={styles.row}>
      <Text style={promptStyle}>{prompt}</Text>
      <Pressable accessibilityRole="link" onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 8, right: 16 }}>
        <Text style={[styles.action, onPrimary && { color: colors.white }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 44 },
  prompt: { fontSize: 13 },
  action: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primaryLight, textDecorationLine: 'underline' },
});
