import { ComingSoon } from '@/components/coming-soon';
import { RoleGate } from '@/components/role-gate';

export default function Screen() {
  return (
    <RoleGate route="tables">
      <ComingSoon title="Manajemen Meja" note="Fitur ini segera hadir." />
    </RoleGate>
  );
}
