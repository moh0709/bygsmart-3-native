import React from 'react';
import { AppScreen } from '../components/ui';

/* Shared legal-article pattern (Design System 2.0, docs/UI_OVERHAUL_PLAN.md §C9)
   — replicated inline across Privacy/Terms/Cookies/Gdpr. Legal wording unchanged. */
const LegalHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-heading text-text-primary dark:text-text-dark-primary pt-4">{children}</h2>
);

const TermsPage: React.FC = () => {
  return (
    <AppScreen
      width="reading"
      hasBottomNav={false}
      header={{ title: 'Handelsbetingelser', back: true }}
      className="min-h-dvh bg-bg dark:bg-bg-dark"
    >
      <article className="text-body text-text-secondary dark:text-text-dark-secondary space-y-4 pt-2 pb-10">
        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Senest opdateret: 1. marts 2026</p>
        <p>
          Disse betingelser regulerer brugen af BygSmart. Ved oprettelse af konto accepterer du disse
          vilkår.
        </p>
        <LegalHeading>Abonnement og betaling</LegalHeading>
        <p>
          Betalte abonnementer faktureres via Stripe. Opsigelse træder i kraft ved udgangen af den
          aktuelle betalingsperiode.
        </p>
        <LegalHeading>Ansvarsbegrænsning</LegalHeading>
        <p>
          BygSmart leveres som et digitalt værktøj. Brugeren har fortsat ansvar for faglig kontrol,
          myndighedskrav og kontraktlige forpligtelser.
        </p>
        <LegalHeading>Lovvalg</LegalHeading>
        <p>Tvister afgøres efter dansk ret med værneting i Danmark.</p>
      </article>
    </AppScreen>
  );
};

export default TermsPage;
