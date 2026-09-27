import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Maps an API error onto the form: field issues go to their fields, anything else
 * to the `root` error shown above the submit button.
 */
export function applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (error instanceof ApiError && error.issues.length > 0) {
    for (const issue of error.issues) setError(issue.path as Path<T>, { message: issue.message });
    return;
  }
  setError('root', { message: error instanceof Error ? error.message : 'Terjadi kesalahan' });
}
