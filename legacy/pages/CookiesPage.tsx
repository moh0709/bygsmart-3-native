import React from 'react';
import { AppScreen } from '../components/ui';

/* Shared legal-article pattern (Design System 2.0, docs/UI_OVERHAUL_PLAN.md §C9)
   — replicated inline across Privacy/Terms/Cookies/Gdpr. Legal wording unchanged. */
const LegalHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-heading text-text-primary dark:text-text-dark-primary pt-4">{children}</h2>
);

const CookiesPage: React.FC = () => {
  return (
    <AppScreen
      width="reading"
      hasBottomNav={false}
      header={{ title: 'Cookiepolitik', back: true }}
      className="min-h-dvh bg-bg dark:bg-bg-dark"
    >
      <article className="text-body text-text-secondary dark:text-text-dark-secondary space-y-4 pt-2 pb-10">
        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Senest opdateret: 1. marts 2026</p>
        <p>BygSmart bruger cookies til sessionsstyring, sikkerhed og valgfri analyse.</p>
        <LegalHeading>Nødvendige cookies</LegalHeading>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-text-tertiary dark:marker:text-text-dark-tertiary">
          <li>Supabase autentificering og session.</li>
          <li>Sikkerhedsrelaterede tokens og anti-misbrug.</li>
        </ul>
        <LegalHeading>Analysecookies</LegalHeading>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-text-tertiary dark:marker:text-text-dark-tertiary">
          <li>Sentry og Web Vitals (kun ved samtykke).</li>
        </ul>
        <LegalHeading>Samtykke</LegalHeading>
        <p>
          Du kan til enhver tid ændre dit samtykke via cookie-banneret eller ved at rydde cookies i
          browseren.
        </p>
      </article>
    </AppScreen>
  );
};

export default CookiesPage;
