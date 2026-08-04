import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

const CookieConsentBanner: React.FC = () => {
  useEffect(() => {
    (CookieConsent as any).run({
      cookie: {
        name: 'bygsmart_cookie_consent',
      },
      guiOptions: {
        consentModal: {
          layout: 'box',
          position: 'bottom right',
        },
        preferencesModal: {
          layout: 'box',
          position: 'right',
        },
      },
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {
          enabled: false,
          autoClear: {
            cookies: [
              {
                name: /^_ga/,
              },
            ],
          },
        },
      },
      language: {
        default: 'da',
        translations: {
          da: {
            consentModal: {
              title: 'Vi bruger cookies',
              description:
                'Vi bruger nødvendige cookies til login og sikkerhed. Analysecookies bruges kun med dit samtykke.',
              acceptAllBtn: 'Accepter alle',
              acceptNecessaryBtn: 'Kun nødvendige',
              showPreferencesBtn: 'Indstillinger',
              footer:
                '<a href="/#/privacy">Privatliv</a> ø <a href="/#/cookies">Cookies</a> ø <a href="/#/terms">Vilkår</a>',
            },
            preferencesModal: {
              title: 'Cookie-indstillinger',
              acceptAllBtn: 'Accepter alle',
              acceptNecessaryBtn: 'Kun nødvendige',
              savePreferencesBtn: 'Gem valg',
              closeIconLabel: 'Luk',
              sections: [
                {
                  title: 'Nødvendige',
                  description: 'Bruges til login, sikkerhed og drift af applikationen.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analyse',
                  description: 'Bruges til performance og fejlsporing (Sentry/Web Vitals).',
                  linkedCategory: 'analytics',
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
};

export default CookieConsentBanner;
