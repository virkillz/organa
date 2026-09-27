import { RoleGate } from '@/components/role-gate';
import { SectionStack } from '@/components/section-stack';

export default function Layout() {
  return (
    <RoleGate route="forecast">
      <SectionStack title="Prediksi Stok" />
    </RoleGate>
  );
}
