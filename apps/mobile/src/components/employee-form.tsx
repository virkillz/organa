import { zodResolver } from '@hookform/resolvers/zod';
import { createEmployeeSchema, EMPLOYEE_ROLES, ROLE_LABELS, WEEKDAYS, type Employee } from '@organa/shared';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { DayChips } from '@/components/day-chips';
import { LabeledField, SelectField } from '@/components/ui/fields';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/form';
import { space } from '@/theme/tokens';

type Form = z.input<typeof createEmployeeSchema>;

/** Form state + submit for creating an employee; render the fields with <EmployeeFields form={...} />. */
export function useEmployeeForm(outletId: string, onCreated: (employee: Employee) => void) {
  const empty: Form = { outletId, name: '', role: 'HEAD_CHEF', pin: '', shiftDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] };
  const form = useForm<Form>({ resolver: zodResolver(createEmployeeSchema), defaultValues: empty });
  const submit = form.handleSubmit(async (values) => {
    try {
      // Use the current outlet, not the one captured when the form mounted.
      onCreated(await api.createEmployee({ ...values, outletId }));
      form.reset(empty);
    } catch (e) {
      applyApiError(e, form.setError);
    }
  });
  return { form, submit, submitting: form.formState.isSubmitting };
}

export function EmployeeFields({ form }: { form: ReturnType<typeof useEmployeeForm>['form'] }) {
  const {
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <LabeledField
            label="Nama Karyawan:"
            placeholder="mis. Marcell"
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <SelectField
            label="Peran:"
            value={field.value}
            onChange={field.onChange}
            options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            error={errors.role?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="pin"
        render={({ field }) => (
          <LabeledField
            label="Kode Unik"
            placeholder="6 digit angka"
            keyboardType="number-pad"
            maxLength={6}
            value={field.value}
            onChangeText={(t) => field.onChange(t.replace(/\D/g, ''))}
            onBlur={field.onBlur}
            error={errors.pin?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="shiftDays"
        render={({ field }) => (
          <View style={{ gap: space.sm }}>
            <Text variant="label">Shift Kerja</Text>
            <DayChips value={field.value} onChange={field.onChange} days={WEEKDAYS} />
            {errors.shiftDays ? <Text variant="error">{errors.shiftDays.message}</Text> : null}
          </View>
        )}
      />
      {errors.root ? <Text variant="error">{errors.root.message}</Text> : null}
    </>
  );
}
