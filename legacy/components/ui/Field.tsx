import React, { useId } from 'react';
import { cn } from './cn';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  id: string;
  children: React.ReactNode;
}

/** Shared label / hint / error wrapper so every form field looks identical. */
const FieldShell: React.FC<FieldShellProps> = ({ label, hint, error, required, id, children }) => (
  <div className="w-full">
    {label && (
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5"
      >
        {label}
        {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
        {error}
      </p>
    ) : hint ? (
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-text-tertiary dark:text-text-dark-tertiary">
        {hint}
      </p>
    ) : null}
  </div>
);

const controlClasses = (error?: string) =>
  cn(
    'w-full h-11 rounded-control border bg-bg px-3 text-sm text-text-primary placeholder:text-text-tertiary',
    'transition-colors duration-150',
    'dark:bg-bg-dark-surface dark:text-text-dark-primary dark:placeholder:text-text-dark-tertiary',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    error
      ? 'border-danger focus:border-danger'
      : 'border-border-strong focus:border-brand-primary dark:border-border-dark-strong'
  );

type CommonFieldProps = {
  label?: string;
  hint?: string;
  error?: string;
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonFieldProps {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className, id: idProp, ...rest }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <FieldShell label={label} hint={hint} error={error} required={required} id={id}>
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(controlClasses(error), className)}
          {...rest}
        />
      </FieldShell>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, CommonFieldProps {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required, className, id: idProp, rows = 4, ...rest }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <FieldShell label={label} hint={hint} error={error} required={required} id={id}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(controlClasses(error), 'h-auto py-2.5 resize-y', className)}
          {...rest}
        />
      </FieldShell>
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, CommonFieldProps {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, required, className, id: idProp, children, ...rest }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <FieldShell label={label} hint={hint} error={error} required={required} id={id}>
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(controlClasses(error), 'appearance-none pr-9 bg-no-repeat bg-[right_0.75rem_center]', className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2398A2B3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          }}
          {...rest}
        >
          {children}
        </select>
      </FieldShell>
    );
  }
);
Select.displayName = 'Select';
