
import React from 'react';

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 text-text-primary dark:text-text-dark-primary bg-bg dark:bg-bg-dark-surface placeholder:text-text-tertiary dark:placeholder:text-text-dark-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 ${props.className || ''}`}
  />
);
