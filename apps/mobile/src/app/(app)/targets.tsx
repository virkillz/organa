import { ComingSoon } from '@/components/coming-soon';
import { RoleGate } from '@/components/role-gate';

export default function Screen() {
  return (
    <RoleGate route="targets">
      <ComingSoon title="Target" note="Fitur ini segera hadir." />
    </RoleGate>
  );
}
