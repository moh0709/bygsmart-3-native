import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavItems } from './BottomNavBar';
import { cn } from './ui/cn';

/**
 * Left navigation rail for ≥md viewports (tablet/desktop) — replaces the
 * bottom nav there. Same five destinations plus Team & Indstillinger.
 * MainLayout reserves the same 88 px with margin + width, so page content
 * never occupies the rail's layout region.
 */
interface NavRailProps {
  projectUnread: number;
}

const NavRail: React.FC<NavRailProps> = ({ projectUnread }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Composed Kernel + module-contributed nav (Phase 5 slot takeover): main
  // destinations at the top, rail-only extras (Team, Indstillinger) pinned
  // to the bottom.
  const items = useNavItems('rail');
  const mainItems = useMemo(() => items.filter((i) => i.surface === 'bottom'), [items]);
  const railExtras = useMemo(() => items.filter((i) => i.surface === 'rail'), [items]);

  const railItem = (
    active: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode,
    key: string,
    badge?: boolean
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex w-16 flex-col items-center gap-1 rounded-card py-2.5 text-caption font-bold',
        'transition-colors duration-fast',
        active
          ? 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light'
          : 'text-text-tertiary hover:text-text-primary hover:bg-bg-subtle dark:text-text-dark-tertiary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted/50'
      )}
    >
      <span className="relative inline-flex">
        {icon}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full border border-bg dark:border-bg-dark-surface" aria-hidden="true" />
        )}
      </span>
      {label}
    </button>
  );

  return (
    <nav
      aria-label="Hovednavigation"
      className="hidden md:flex fixed inset-y-0 left-0 z-[90] isolate w-[88px] flex-col items-center gap-1.5 overflow-hidden border-r border-border bg-bg py-5 pt-safe dark:border-border-dark dark:bg-bg-dark-surface"
    >
      <button
        type="button"
        onClick={() => navigate('/home')}
        aria-label="BygSmart — Hjem"
        className="mb-4 flex w-11 h-11 items-center justify-center rounded-card bg-brand-primary text-white text-heading font-extrabold"
      >
        B
      </button>

      {mainItems.map((item) =>
        railItem(
          item.match(location.pathname),
          () => navigate(item.path),
          item.label,
          <item.icon className="w-5 h-5" />,
          item.path,
          item.path === '/projects' && projectUnread > 0
        )
      )}

      <div className="grow" />

      {railExtras.map((item) =>
        railItem(
          item.match(location.pathname),
          () => navigate(item.path),
          item.label,
          <item.icon className="w-5 h-5" />,
          item.path
        )
      )}
    </nav>
  );
};

export default NavRail;
