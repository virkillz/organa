import { ComingSoon } from '@/components/coming-soon';
import { RoleGate } from '@/components/role-gate';

export default function Screen() {
  return (
    <RoleGate route="support">
      <ComingSoon title="Support" note="Hubungi tim Organa melalui WhatsApp. Kontak segera tersedia." />
    </RoleGate>
  );
}
