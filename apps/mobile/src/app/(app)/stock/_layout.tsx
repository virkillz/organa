import { RoleGate } from '@/components/role-gate';
import { SectionStack } from '@/components/section-stack';

export default function StockLayout() {
  return (
    <RoleGate route="stock">
      <SectionStack title="Manajemen Stok" />
    </RoleGate>
  );
}
