import React from 'react';
import { useToolAccess } from '../../../contexts/ToolAccessProvider';

/**
 * Pro-gated route wrapper — enforces per-tool access on render so deep links
 * and page refreshes respect gating. Moved verbatim from App.tsx in the
 * Phase 4 extraction; the runtime authority stays useToolAccess (server-
 * resolved Pro/campaign map).
 */
export const ProtectedToolRoute: React.FC<{ toolId: string; children: React.ReactNode }> = ({ toolId, children }) => {
  const { allowed } = useToolAccess(toolId);
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <svg className="w-14 h-14 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18 10h-1V7A5 5 0 0 0 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-6 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm3-7H9V7a3 3 0 1 1 6 0v3Z" />
        </svg>
        <h2 className="text-xl font-bold text-text-primary dark:text-text-dark-primary">Pro-værktøj</h2>
        <p className="text-text-secondary dark:text-text-dark-secondary max-w-xs">
          Dette værktøj kræver et Pro-abonnement. Opgrader for at få adgang.
        </p>
        <a
          href="#/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:bg-blue-600 transition-colors"
        >
          Opgrader til Pro
        </a>
      </div>
    );
  }
  return <>{children}</>;
};
