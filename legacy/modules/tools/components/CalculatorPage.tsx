import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { BackButton } from '../../../components/BackButton';
import { CalculatorActions } from './CalculatorActions';
import { Share2Icon, CheckIcon } from '../../../components/icons';
import { HelpDrawer } from './HelpDrawer';
import type { HelpContent } from './HelpDrawer';
import type { CalculatorReportData } from '../services/calculatorPdf';
import { Badge, cn } from '../../../components/ui';

export type { HelpContent };
export type { CalculatorReportData };

// ── Registration context ─────────────────────────────────────────────────────
// Calculators nested inside CalculatorPage can call useCalculatorPage() to
// imperatively push help content and report data without threading props.

export interface CalculatorPageRegistration {
  helpContent?: HelpContent;
  reportData?: CalculatorReportData;
}

interface CalculatorPageContextValue {
  register: (data: CalculatorPageRegistration) => void;
}

const CalculatorPageContext = createContext<CalculatorPageContextValue | null>(null);

export const useCalculatorPage = () => useContext(CalculatorPageContext);

// ── Props ────────────────────────────────────────────────────────────────────

interface CalculatorPageProps {
  title: string;
  children: React.ReactNode;
  /** Optional sticky result bar to pin above the bottom nav on mobile. */
  stickyResult?: React.ReactNode;
  /** Label shown next to the sticky result value */
  stickyResultLabel?: string;
  /** Plain-text result to share (e.g. "3.2 m³ beton"). When provided a share button appears. */
  shareValue?: string;
  /** Help content to display in the drawer when the "?" button is pressed. */
  helpContent?: HelpContent;
  /** Structured report data for branded vector PDF export. Passed directly when
   *  the calculator computes it in the parent rather than calling register(). */
  reportData?: CalculatorReportData;
  /** Slot for a mode-toggle control rendered below the title row in the sticky header. */
  modeToggle?: React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────────

const HEADER_BUTTON =
  'w-11 h-11 min-h-11 min-w-11 flex items-center justify-center rounded-full ' +
  'text-text-secondary hover:text-text-primary hover:bg-bg-muted ' +
  'dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted ' +
  'transition-colors duration-150';

const CalculatorPage: React.FC<CalculatorPageProps> = ({
  title,
  children,
  stickyResult,
  stickyResultLabel,
  shareValue,
  helpContent: helpContentProp,
  reportData: reportDataProp,
  modeToggle,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [shareDone, setShareDone] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [registeredHelp, setRegisteredHelp] = useState<HelpContent | undefined>(undefined);
  const [registeredReportData, setRegisteredReportData] = useState<CalculatorReportData | undefined>(undefined);
  const activeHelp = registeredHelp ?? helpContentProp;
  const reportData = registeredReportData ?? reportDataProp;

  const register = useCallback((data: CalculatorPageRegistration) => {
    if (data.helpContent !== undefined) setRegisteredHelp(data.helpContent);
    if (data.reportData !== undefined) setRegisteredReportData(data.reportData);
  }, []);

  const handleShare = useCallback(async () => {
    if (!shareValue) return;
    const text = `${title}: ${shareValue}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareDone(true);
        setTimeout(() => setShareDone(false), 2000);
      }
    } catch {
      // user cancelled or API unavailable
    }
  }, [title, shareValue]);

  const showHelp = !!activeHelp;
  const category = reportData?.category;

  return (
    <CalculatorPageContext.Provider value={{ register }}>
      <div className="bg-bg-subtle dark:bg-bg-dark min-h-screen transition-colors duration-300 flex flex-col">
        {/* ── Header zone: back · tool name + category · help/share ───── */}
        <header
          className="sticky top-topbar pt-3 bg-bg-subtle/90 dark:bg-bg-dark/90 backdrop-blur-sm z-10 border-b border-border dark:border-border-dark transition-colors duration-300"
        >
          {/* Title row */}
          <div className="px-4 pb-2 flex items-center gap-2">
            <BackButton />

            <div className="flex-1 min-w-0 flex flex-col items-center">
              <h1 className="text-heading text-text-primary dark:text-text-dark-primary truncate max-w-full">
                {title}
              </h1>
              {category && (
                <Badge variant="brand" className="mt-0.5">
                  {category}
                </Badge>
              )}
            </div>

            {/* Right-side actions */}
            <div className="flex items-center shrink-0">
              {showHelp && (
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  aria-label="Åbn hjælp"
                  className={HEADER_BUTTON}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </button>
              )}

              {shareValue ? (
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Del resultat"
                  className={HEADER_BUTTON}
                >
                  {shareDone ? <CheckIcon className="w-5 h-5 text-success" /> : <Share2Icon className="w-5 h-5" />}
                </button>
              ) : (
                // Keep the header balanced when neither help nor share is shown
                !showHelp && <div className="w-11" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* Optional mode-toggle strip */}
          {modeToggle && (
            <div className="px-4 pb-2">
              {modeToggle}
            </div>
          )}
        </header>

        {/* MainLayout provides bottom-nav clearance; only the fixed sticky
            result bar needs extra room on mobile. */}
        <main className={cn('flex-grow p-4', stickyResult && 'pb-16 md:pb-4')}>
          <div ref={contentRef}>
            {children}
          </div>
          <CalculatorActions targetRef={contentRef} title={title} reportData={reportData} />
        </main>

        {/* ── Sticky Mobile Result Bar ───────────────────────────────── */}
        {stickyResult && (
          <div
            className="fixed left-0 right-0 z-[80] bg-bg/95 dark:bg-bg-dark-surface/95 backdrop-blur-md border-t border-border dark:border-border-dark shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between md:hidden"
            style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary truncate mr-3">
              {stickyResultLabel ?? 'Resultat'}
            </span>
            <div className="text-title tabular-nums text-brand-primary dark:text-brand-light shrink-0">
              {stickyResult}
            </div>
          </div>
        )}

        {/* ── Help Drawer ────────────────────────────────────────────── */}
        <HelpDrawer
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          title={`${title} — Hjælp`}
          content={activeHelp}
        />
      </div>
    </CalculatorPageContext.Provider>
  );
};

export default CalculatorPage;
