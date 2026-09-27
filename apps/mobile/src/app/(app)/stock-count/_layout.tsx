import { RoleGate } from '@/components/role-gate';
import { SectionStack } from '@/components/section-stack';

export default function StockCountLayout() {
  return (
    <RoleGate route="stock-count">
      <SectionStack title="Update Stok Opname" />
    </RoleGate>
  );
}
