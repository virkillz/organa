import { RoleGate } from '@/components/role-gate';
import { SectionStack } from '@/components/section-stack';

export default function Layout() {
  return (
    <RoleGate route="analysis">
      <SectionStack title="Analisis Stok" />
    </RoleGate>
  );
}
