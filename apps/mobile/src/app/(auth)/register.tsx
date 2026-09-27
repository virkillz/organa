import { zodResolver } from '@hookform/resolvers/zod';
import { registerOwnerSchema } from '@organa/shared';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { z } from 'zod';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { UnderlineField } from '@/components/ui/fields';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/form';
import { useSession } from '@/lib/session';
import { space } from '@/theme/tokens';

const formSchema = registerOwnerSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Password tidak sama',
  });
type Form = z.input<typeof formSchema>;

export default function Register() {
  const signIn = useSession((s) => s.signIn);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ confirmPassword: _, ...values }) => {
    try {
      // needsBusinessSetup is true for a new account, so the guard opens the setup flow.
      await signIn(await api.register(values));
    } catch (e) {
      applyApiError(e, setError);
    }
  });

  const field = (name: keyof Form, props: Partial<React.ComponentProps<typeof UnderlineField>>) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <UnderlineField value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={errors[name]?.message} {...props} />
      )}
    />
  );

  return (
    <AuthScreen
      title="Daftarkan Akun"
      subtitle="Bergabung dengan Organa untuk dapat menggunakan semua fitur-fitur kami"
      footer={
        <>
          <Button title="DAFTAR" onPress={onSubmit} loading={isSubmitting} />
          <Text style={styles.center}>Sudah memiliki akun?</Text>
          <Button title="LOG IN" variant="outline" onPress={() => router.replace('/owner-login')} />
        </>
      }>
      {field('fullName', { placeholder: 'Nama Lengkap', autoCapitalize: 'words', autoComplete: 'name' })}
      {field('email', { placeholder: 'Email', keyboardType: 'email-address', autoComplete: 'email' })}
      {field('password', { placeholder: 'Password', secure: true, autoComplete: 'new-password' })}
      {field('confirmPassword', { placeholder: 'Konfirmasi ulang passwordmu', secure: true, autoComplete: 'new-password' })}
      {errors.root ? <Text variant="error">{errors.root.message}</Text> : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', fontSize: 13, marginTop: space.xs },
});
