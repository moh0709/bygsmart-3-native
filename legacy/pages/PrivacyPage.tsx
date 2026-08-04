import React from 'react';
import { AppScreen } from '../components/ui';

/* Shared legal-article pattern (Design System 2.0, docs/UI_OVERHAUL_PLAN.md §C9)
   — replicated inline across Privacy/Terms/Cookies/Gdpr. Legal wording unchanged. */
const LegalHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-heading text-text-primary dark:text-text-dark-primary pt-4">{children}</h2>
);

const PrivacyPage: React.FC = () => {
  return (
    <AppScreen
      width="reading"
      hasBottomNav={false}
      header={{ title: 'Privatlivspolitik', back: true }}
      className="min-h-dvh bg-bg dark:bg-bg-dark"
    >
      <article className="text-body text-text-secondary dark:text-text-dark-secondary space-y-4 pt-2 pb-10">
        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Senest opdateret: 1. marts 2026</p>
        <p>
          BygSmart behandler personoplysninger for at levere projektstyring, login, samarbejde, support
          og sikkerhedslogning. Vi behandler kun nødvendige oplysninger og opbevarer dem så længe det er
          nødvendigt for drift, lovkrav og dokumentation.
        </p>
        <LegalHeading>Data vi behandler</LegalHeading>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-text-tertiary dark:marker:text-text-dark-tertiary">
          <li>Kontodata: navn, e-mail, brugernavn, abonnementstype.</li>
          <li>Projektdata: opgaver, dokumenter, billeder, tidsregistrering og loghistorik.</li>
          <li>Tekniske data: sessionsdata, fejlrapporter og sikkerhedshændelser.</li>
        </ul>
        <LegalHeading>Dine rettigheder</LegalHeading>
        <p>
          Du har ret til indsigt, rettelse, sletning, dataportabilitet og begrænsning af behandling.
          Kontakt os på privacy@bygsmart.dk for anmodninger.
        </p>
        <LegalHeading>Databehandlere</LegalHeading>
        <p>
          BygSmart anvender Supabase, Stripe og Google Gemini som databehandlere. Databehandleraftaler
          skal være indgået før kommerciel drift.
        </p>
      </article>
    </AppScreen>
  );
};

export default PrivacyPage;
