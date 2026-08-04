import React from 'react';
import { cn } from './cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Deterministic, decorative avatar palette (design constant, not themed).
 * Chosen for ≥4.5:1 contrast with white initials.
 */
const AVATAR_COLORS = ['#4E5BA6', '#175CD3', '#067647', '#B54708', '#B42318', '#7839EE', '#C11574', '#3E4784'];

const SIZES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-caption',
  md: 'w-10 h-10 text-label',
  lg: 'w-14 h-14 text-heading',
};

const PRESENCE_SIZES: Record<AvatarSize, string> = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
};

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

export const colorOf = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — used for initials, color hash and accessible label. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** Show an online-presence dot. */
  online?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', online, className, style, ...rest }) => (
  <span
    role="img"
    aria-label={name}
    title={name}
    className={cn(
      'relative inline-flex items-center justify-center rounded-full font-bold text-white select-none shrink-0',
      SIZES[size],
      className
    )}
    style={{ backgroundColor: src ? undefined : colorOf(name), ...style }}
    {...rest}
  >
    {src ? (
      <img src={src} alt="" className="w-full h-full rounded-full object-cover" />
    ) : (
      initialsOf(name)
    )}
    {online && (
      <span
        className={cn(
          'absolute bottom-0 right-0 rounded-full bg-success border-bg dark:border-bg-dark-surface',
          PRESENCE_SIZES[size]
        )}
        aria-hidden="true"
      />
    )}
  </span>
);

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  people: Array<{ name: string; src?: string | null; online?: boolean }>;
  size?: AvatarSize;
  /** Max avatars before collapsing into a "+N" bubble. */
  max?: number;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({ people, size = 'sm', max = 4, className, ...rest }) => {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  return (
    <div className={cn('flex items-center', className)} {...rest}>
      {visible.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          online={p.online}
          size={size}
          className={cn('ring-2 ring-bg dark:ring-bg-dark-surface', i > 0 && '-ml-2')}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            '-ml-2 inline-flex items-center justify-center rounded-full font-bold select-none shrink-0',
            'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary',
            'ring-2 ring-bg dark:ring-bg-dark-surface',
            SIZES[size]
          )}
          aria-label={`${overflow} flere`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};
