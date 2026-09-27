import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/theme/tokens';

/** Layout for login/setup screens: green quarter-circle back button, centered title, scrollable form. */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  onBack,
  showBack = true,
  align = 'center',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  align?: 'center' | 'left';
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.decorOuter} />
      <View style={styles.decorInner} />
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          hitSlop={12}
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')))}
          style={[styles.back, { top: insets.top + 8 }]}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + space.lg }]}
        keyboardShouldPersistTaps="handled">
        <Text variant="title" style={[styles.title, align === 'left' && styles.left]}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyStrong" style={[styles.subtitle, align === 'left' && styles.left]}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  decorOuter: {
    position: 'absolute',
    top: -130,
    left: -130,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.backgroundAlt,
  },
  decorInner: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.primaryTint,
  },
  back: { position: 'absolute', left: 20, zIndex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.lg },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: space.md, paddingHorizontal: space.lg },
  left: { textAlign: 'left', paddingHorizontal: 0 },
  body: { marginTop: space.xl, gap: space.lg },
  footer: { marginTop: 'auto', paddingTop: space.xl, gap: space.md },
});
