import { RoleGate } from '@/components/role-gate';
import { SectionStack } from '@/components/section-stack';

export default function ProductsLayout() {
  return (
    <RoleGate route="products">
      <SectionStack title="Manajemen Produk" />
    </RoleGate>
  );
}
