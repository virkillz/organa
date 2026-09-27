import { zodResolver } from '@hookform/resolvers/zod';
import { businessSetupSchema } from '@organa/shared';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { LabeledField } from '@/components/ui/fields';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/form';
import { useSession } from '@/lib/session';

type Form = z.input<typeof businessSetupSchema>;

export default function BusinessSetup() {
  const { signOut, setUser, setSetupPending, setActiveOutlet } = useSession.getState();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(businessSetupSchema),
    defaultValues: { businessName: '', phone: '+62 ', address: '', employeeCount: '' as unknown as number },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.setupBusiness(values);
      // Keep the setup flow open for the employee step even though the business is now set up.
      await setSetupPending(true);
      const user = await api.me();
      await setUser(user);
      await setActiveOutlet(user.outletIds[0] ?? '');
      router.replace('/setup/employees');
    } catch (e) {
      applyApiError(e, setError);
    }
  });

  const field = (
    name: keyof Form,
    label: string,
    props: Partial<React.ComponentProps<typeof LabeledField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <LabeledField
          label={label}
          value={f.value === undefined ? '' : String(f.value)}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          error={errors[name]?.message}
          {...props}
        />
      )}
    />
  );

  return (
    <AuthScreen
      title="Pengaturan Bisnis"
      align="left"
      onBack={() => signOut()}
      footer={<Button title="KONFIRMASI" onPress={onSubmit} loading={isSubmitting} />}>
      {field('businessName', 'Nama Usaha Anda', { placeholder: 'mis. SteakWarung_JKT' })}
      {field('phone', 'No. Telepon', { keyboardType: 'phone-pad', autoComplete: 'tel' })}
      {field('address', 'Alamat', { multiline: true, placeholder: 'Alamat lengkap usaha' })}
      {field('employeeCount', 'Jumlah Karyawan', { keyboardType: 'number-pad', placeholder: '0' })}
      {errors.root ? <Text variant="error">{errors.root.message}</Text> : null}
    </AuthScreen>
  );
}
