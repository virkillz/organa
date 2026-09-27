import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, fonts } from '@/theme/tokens';

const variants = StyleSheet.create({
  title: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 38, color: colors.ink },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.primary },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  error: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.danger },
});

export type TextVariant = keyof typeof variants;

export function Text({ variant = 'body', style, ...rest }: RNTextProps & { variant?: TextVariant }) {
  return <RNText style={[variants[variant], style]} {...rest} />;
}
