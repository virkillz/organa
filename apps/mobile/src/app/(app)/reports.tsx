import { ComingSoon } from '@/components/coming-soon';
import { RoleGate } from '@/components/role-gate';

export default function Screen() {
  return (
    <RoleGate route="reports">
      <ComingSoon title="Laporan" note="Fitur ini segera hadir." />
    </RoleGate>
  );
}
