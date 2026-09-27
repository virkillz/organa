import { Stack } from 'expo-router';
import { RoleGate } from '@/components/role-gate';
import { SectionStack } from '@/components/section-stack';

export default function PosLayout() {
  return (
    <RoleGate route="pos">
      <SectionStack title="Kasir">
        <Stack.Screen name="success" options={{ headerShown: false, gestureEnabled: false }} />
      </SectionStack>
    </RoleGate>
  );
}
