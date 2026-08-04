import React from 'react';
import { BottomSheet } from '../../../components/ui';

export interface HelpVariable {
  name: string;
  symbol?: string;
  unit?: string;
  description: string;
}

export interface HelpStandard {
  code: string;
  clause?: string;
  note?: string;
}

export interface HelpContent {
  formaal?: string;
  variabler?: HelpVariable[];
  formel?: string;
  formelDiagram?: React.ReactNode;
  /** Accepts a prose string or a list of assumption bullets from the registry. */
  antagelser?: string | string[];
  /** Plain-text standards summary (legacy / simple). */
  standarder?: string;
  /** Structured standards list from the registry — renders as code/clause/note rows. */
  standarderStruktureret?: HelpStandard[];
  /** Optional worked-through example shown below assumptions. */
  workedExample?: string;
  disclaimer?: React.ReactNode;
}

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  content?: HelpContent;
}

const Section: React.FC<{ heading: string; children: React.ReactNode }> = ({ heading, children }) => (
  <section className="mb-5">
    <h3 className="text-caption font-bold text-text-tertiary dark:text-text-dark-tertiary uppercase tracking-widest mb-2 pb-1 border-b border-border dark:border-border-dark">
      {heading}
    </h3>
    {children}
  </section>
);

const TableHeadCell: React.FC<{ children: React.ReactNode; last?: boolean }> = ({ children, last }) => (
  <th className={`pb-1.5 font-semibold ${last ? '' : 'pr-3'}`}>{children}</th>
);

/**
 * Calculator help drawer built on the kit BottomSheet — focus trap, Escape,
 * scroll lock and close button come from the Modal primitive.
 */
export const HelpDrawer: React.FC<HelpDrawerProps> = ({ open, onClose, title = 'Hjælp', content }) => (
  <BottomSheet open={open} onClose={onClose} title={title} size="md">
    <div className="text-body text-text-secondary dark:text-text-dark-secondary">
      {!content ? (
        <p className="italic text-text-tertiary dark:text-text-dark-tertiary">Ingen hjælpetekst tilgængelig.</p>
      ) : (
        <>
          {content.formaal && (
            <Section heading="Formål">
              <p className="leading-relaxed">{content.formaal}</p>
            </Section>
          )}

          {content.variabler && content.variabler.length > 0 && (
            <Section heading="Variabler">
              <div className="overflow-x-auto">
                <table className="w-full text-caption min-w-[320px]">
                  <thead>
                    <tr className="text-left text-text-tertiary dark:text-text-dark-tertiary">
                      <TableHeadCell>Variabel</TableHeadCell>
                      <TableHeadCell>Symbol</TableHeadCell>
                      <TableHeadCell>Enhed</TableHeadCell>
                      <TableHeadCell last>Beskrivelse</TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {content.variabler.map((v, i) => (
                      <tr key={i} className="border-t border-border dark:border-border-dark">
                        <td className="py-1.5 pr-3 font-medium text-text-primary dark:text-text-dark-primary whitespace-nowrap">{v.name}</td>
                        <td className="py-1.5 pr-3 font-mono text-text-primary dark:text-text-dark-primary">{v.symbol ?? '—'}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{v.unit ?? '—'}</td>
                        <td className="py-1.5 leading-snug">{v.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {(content.formel || content.formelDiagram) && (
            <Section heading="Formel">
              {content.formel && (
                <pre className="bg-bg-muted dark:bg-bg-dark-muted rounded-card p-3 font-mono text-caption overflow-x-auto mb-2 text-text-primary dark:text-text-dark-primary whitespace-pre-wrap">
                  {content.formel}
                </pre>
              )}
              {content.formelDiagram && (
                <div className="mt-2">{content.formelDiagram}</div>
              )}
            </Section>
          )}

          {content.antagelser && (
            <Section heading="Antagelser">
              {Array.isArray(content.antagelser) ? (
                <ul className="list-disc list-inside space-y-1 leading-relaxed">
                  {content.antagelser.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              ) : (
                <p className="leading-relaxed">{content.antagelser}</p>
              )}
            </Section>
          )}

          {content.workedExample && (
            <Section heading="Regneeksempel">
              <pre className="bg-bg-muted dark:bg-bg-dark-muted rounded-card p-3 font-mono text-caption overflow-x-auto text-text-primary dark:text-text-dark-primary whitespace-pre-wrap">
                {content.workedExample}
              </pre>
            </Section>
          )}

          {content.standarderStruktureret && content.standarderStruktureret.length > 0 && (
            <Section heading="Referencer">
              <div className="overflow-x-auto">
                <table className="w-full text-caption min-w-[280px]">
                  <thead>
                    <tr className="text-left text-text-tertiary dark:text-text-dark-tertiary">
                      <TableHeadCell>Standard</TableHeadCell>
                      <TableHeadCell>Punkt</TableHeadCell>
                      <TableHeadCell last>Note</TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {content.standarderStruktureret.map((s, i) => (
                      <tr key={i} className="border-t border-border dark:border-border-dark">
                        <td className="py-1.5 pr-3 font-medium text-text-primary dark:text-text-dark-primary whitespace-nowrap">{s.code}</td>
                        <td className="py-1.5 pr-3">{s.clause ?? '—'}</td>
                        <td className="py-1.5 leading-snug">{s.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {content.standarder && (
            <Section heading="Standarder">
              <p className="leading-relaxed font-mono text-caption bg-bg-muted dark:bg-bg-dark-muted rounded-card p-3 text-text-primary dark:text-text-dark-primary">
                {content.standarder}
              </p>
            </Section>
          )}

          {content.disclaimer && (
            <Section heading="Disclaimer">
              <div className="leading-relaxed">{content.disclaimer}</div>
            </Section>
          )}
        </>
      )}
    </div>
  </BottomSheet>
);

export default HelpDrawer;
