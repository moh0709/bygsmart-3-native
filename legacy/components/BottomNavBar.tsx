
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthProvider';
import { useEntitlements } from '../core/entitlements/EntitlementsProvider';
import { useSlot } from '../core/registry/hooks';
import { KERNEL_NAV } from '../core/shell/kernelNav';
import { getTotalUnreadProjectNotifications } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { cn } from './ui/cn';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ref: string;
  match: (path: string) => boolean;
  /** The raised center action (Scan). */
  center?: boolean;
  surface: 'bottom' | 'rail';
}

/**
 * Composed navigation for both nav surfaces (Phase 5 slot takeover):
 * Kernel entries (Hjem/Scan/Indstillinger — Scan visibility gated on the AR
 * module) + whatever entitled modules contributed into the `nav` slot,
 * sorted by order. `ref` (data-ref-id anchor) derives from the path.
 */
export const useNavItems = (surface: 'bottom' | 'rail'): NavItem[] => {
  const { enabledModules } = useEntitlements();
  const contributions = useSlot('nav');
  return useMemo(() => {
    const kernel = KERNEL_NAV.filter(
      (e) => !e.moduleId || enabledModules.has(e.moduleId)
    );
    let entries = [...kernel, ...contributions]
      .filter((e) => surface === 'rail' || e.surface === 'bottom')
      .sort((a, b) => a.order - b.order);
    // The phone bar has exactly ONE raised center slot. When several active
    // modules contribute center items (e.g. time's Tid at 19 and ar's Scan
    // at 20), only the lowest-order one keeps the slot — the losers are
    // dropped from the phone bar entirely (they remain reachable on the
    // rail, which ignores `center`, and via their in-app entry points).
    if (surface === 'bottom') {
      const winner = entries.find((e) => e.center);
      entries = entries.filter((e) => !e.center || e === winner);
    }
    return entries.map((e) => ({
        path: e.to,
        label: e.label,
        icon: e.icon,
        ref: e.to.replace(/^\//, '').split('/')[0] || 'hjem',
        match: e.match ?? ((p: string) => p.startsWith(e.to)),
        center: e.center ?? false,
        surface: e.surface,
      }));
  }, [surface, enabledModules, contributions]);
};

/** Shared unread-count subscription for nav surfaces. */
export const useProjectUnread = (): number => {
  const { user } = useAuth();
  const [projUnread, setProjUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const count = await getTotalUnreadProjectNotifications();
      if (active) setProjUnread(count);
    };
    refresh();
    const channel = supabase
      .channel('bottom-nav:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` }, refresh)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user?.id]);
  return projUnread;
};

/**
 * Bottom nav v2 (phones — hidden ≥md where NavRail takes over):
 * raised center Scan action, legible 11px labels, opacity-only dim on scroll.
 */
interface BottomNavBarProps {
  projectUnread: number;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ projectUnread }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { transparentMenu } = useTheme();
  const [isDimmed, setIsDimmed] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleItems = useNavItems('bottom');

  const activeIndex = useMemo(() => {
    const idx = visibleItems.findIndex(item => item.match(location.pathname));
    return idx !== -1 ? idx : 0;
  }, [location.pathname, visibleItems]);

  const wakeUp = useCallback(() => {
    setIsDimmed(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    // Dim after 5 seconds of inactivity
    inactivityTimerRef.current = setTimeout(() => setIsDimmed(true), 5000);
  }, []);

  useEffect(() => {
    wakeUp();
    const handleScroll = () => {
      setIsDimmed(true);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [wakeUp]);

  const effectiveDimmed = isDimmed && transparentMenu;

  return (
    <nav
      aria-label="Hovednavigation"
      className="fixed bottom-4 left-4 right-4 z-[90] md:hidden pb-safe"
      onClickCapture={wakeUp}
      onTouchStartCapture={wakeUp}
    >
      <div
        className={cn(
          'bg-bg/95 dark:bg-bg-dark-surface/95 rounded-full border border-border dark:border-border-dark',
          'backdrop-blur-md px-1.5 transition-opacity duration-slow ease-standard shadow-raised',
          effectiveDimmed ? 'opacity-60' : 'opacity-100'
        )}
      >
        <div className="flex w-full items-center">
          {visibleItems.map((item, index) => {
            const isActive = index === activeIndex;

            if (item.center) {
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  data-ref-id={`nav-${item.ref}`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative -mt-5 mx-1 flex w-14 h-14 shrink-0 items-center justify-center rounded-full',
                    'bg-brand-primary text-white border-4 border-bg dark:border-bg-dark-surface shadow-raised',
                    'transition-transform duration-fast active:scale-95',
                    isActive && 'ring-2 ring-brand-primary/40'
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="sr-only">{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                data-ref-id={`nav-${item.ref}`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-full',
                  'transition-colors duration-fast bg-transparent outline-none',
                  'focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bg-dark-surface',
                  isActive
                    ? 'text-brand-primary dark:text-brand-light'
                    : 'text-text-tertiary hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary'
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <span className="relative inline-flex">
                  <item.icon className={cn('w-5 h-5 transition-transform duration-base', isActive ? 'scale-110' : 'scale-100')} />
                  {item.path === '/projects' && projectUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full border border-bg dark:border-bg-dark-surface" aria-hidden="true" />
                  )}
                </span>
                <span className={cn('text-caption font-bold', isActive ? 'opacity-100' : 'opacity-80')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNavBar;
