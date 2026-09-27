import { Drawer } from 'expo-router/drawer';
import { AlertBanner } from '@/components/alert-banner';
import { AppDrawer } from '@/components/app-drawer';
import { useStockAlerts } from '@/lib/alerts';
import { MENU } from '@/lib/menu';
import { colors, fonts } from '@/theme/tokens';

const SECTION_STACKS = new Set(['stock', 'products', 'pos', 'stock-count', 'analysis', 'forecast']);

export default function AppLayout() {
  useStockAlerts();
  return (
    <>
      <Drawer
        drawerContent={(props) => <AppDrawer {...props} />}
        screenOptions={{
          headerTitleAlign: 'center',
          headerTintColor: colors.primary,
          headerTitleStyle: {
            fontFamily: fonts.bold,
            fontSize: 20,
            color: colors.primary,
          },
          headerShadowVisible: false,
          drawerStyle: { width: '78%', maxWidth: 340 },
          sceneStyle: { backgroundColor: colors.background },
        }}>
        <Drawer.Screen name="index" options={{ headerShown: false }} />
        {MENU.map((item) => (
          <Drawer.Screen
            key={item.route}
            name={item.route}
            // Sections with their own stack draw their own header.
            options={{
              title: item.label,
              headerShown: !SECTION_STACKS.has(item.route),
            }}
          />
        ))}
      </Drawer>
      <AlertBanner />
    </>
  );
}
