import React from 'react';
import { AppScreen } from '../components/ui';

/* Shared legal-article pattern (Design System 2.0, docs/UI_OVERHAUL_PLAN.md §C9)
   — replicated inline across Privacy/Terms/Cookies/Gdpr. Legal wording unchanged. */

const GdprPage: React.FC = () => {
  return (
    <AppScreen
      width="reading"
      hasBottomNav={false}
      header={{ title: 'GDPR-rettigheder', back: true }}
      className="min-h-dvh bg-bg dark:bg-bg-dark"
    >
      <article className="text-body text-text-secondary dark:text-text-dark-secondary space-y-4 pt-2 pb-10">
        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Senest opdateret: 1. marts 2026</p>
        <p>Du har følgende rettigheder efter GDPR:</p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-text-tertiary dark:marker:text-text-dark-tertiary">
          <li>Ret til indsigt i dine personoplysninger.</li>
          <li>Ret til rettelse af urigtige oplysninger.</li>
          <li>Ret til sletning (retten til at blive glemt).</li>
          <li>Ret til dataportabilitet.</li>
          <li>Ret til indsigelse mod behandling.</li>
        </ul>
        <p>
          Send anmodninger til privacy@bygsmart.dk. Vi besvarer henvendelser inden for lovpligtige
          tidsfrister.
        </p>
      </article>
    </AppScreen>
  );
};

export default GdprPage;
