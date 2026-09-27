import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useNavigation } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { colors, fonts } from '@/theme/tokens';

function MenuButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buka menu"
      hitSlop={12}
      // Same action as DrawerActions.openDrawer(); it bubbles up to the drawer navigator.
      onPress={() => navigation.dispatch({ type: 'OPEN_DRAWER' })}
      style={{ paddingHorizontal: 4 }}>
      <Ionicons name="menu" size={26} color={colors.primary} />
    </Pressable>
  );
}

/**
 * Stack for one drawer section: the section's index screen shows the menu button,
 * deeper screens show a back arrow. Titles are green and centred as in the designs.
 */
export function SectionStack({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20, color: colors.primary },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.backgroundAlt },
      }}>
      <Stack.Screen name="index" options={{ title, headerLeft: () => <MenuButton /> }} />
      {children}
    </Stack>
  );
}
