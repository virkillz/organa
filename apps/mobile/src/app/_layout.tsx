import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  const hydrated = useSession((s) => s.hydrated);

  useEffect(() => {
    useSession.getState().hydrate();
  }, []);

  const ready = fontsLoaded && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const user = useSession((s) => s.user);
  const setupPending = useSession((s) => s.setupPending);
  const inSetup = !!user && (user.needsBusinessSetup || setupPending);
  const inApp = !!user && !inSetup;
  const wasInApp = useRef(inApp);

  // Stack.Protected cannot redirect out of the setup flow on its own (its anchor, (auth), is also
  // protected at that point), so navigate once the new guards have rendered.
  useEffect(() => {
    if (inApp && !wasInApp.current) router.replace('/');
    wasInApp.current = inApp;
  }, [inApp]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={inSetup}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
