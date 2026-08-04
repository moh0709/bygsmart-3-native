import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { isDemoProfileComplete, saveDemoProfile } from '../services/api/demoProfile';
import { Alert, Button, Card, Input } from '../components/ui';

const ByggeAppLogoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="30"
    height="30"
    viewBox="0 0 30 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Intermediate greeting between "Demo adgang" and the dashboard. A fresh demo
 * account has no identity attached to it, so we ask for the visitor's name and
 * company here — the answers become the profile name / company shown in the
 * app and in the admin dashboard, and are mirrored onto the demo lead row.
 */
const DemoWelcomePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Real accounts and demo visitors who already introduced themselves have
  // nothing to do here — this page is only a gate for fresh demos.
  if (user && (!user.isDemo || isDemoProfileComplete(user.name, user.companyName))) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedCompany = companyName.trim();

    if (trimmedName.length < 2) {
      setError('Indtast dit navn.');
      return;
    }
    if (trimmedCompany.length < 2) {
      setError('Indtast dit firmanavn.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveDemoProfile(trimmedName, trimmedCompany);
      if (!result.success) {
        setError(result.message || 'Kunne ikke gemme oplysningerne. Prøv igen.');
        return;
      }
      // Pull the updated profile so the app greets them by name immediately.
      await refreshUser();
      navigate('/home', { replace: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex flex-col justify-center items-center px-4 py-8 pt-safe pb-safe">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-brand-primary text-white p-3 rounded-card shadow-card">
            <ByggeAppLogoIcon />
          </div>
          <span className="text-title text-text-primary dark:text-text-dark-primary tracking-wide">BYG SMART</span>
        </div>

        <Card padding="lg">
          <h1 className="text-title text-center text-text-primary dark:text-text-dark-primary mb-1">
            Velkommen til BygSmart
          </h1>
          <p className="text-body text-center text-text-secondary dark:text-text-dark-secondary mb-1">
            Din demo er klar.
          </p>
          <p className="text-label text-center text-text-secondary dark:text-text-dark-secondary mb-6">
            Fortæl os lige hvem du er, så tilpasser vi demoen til dig.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="demo-name"
              type="text"
              label="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              maxLength={80}
              placeholder="Dit fulde navn"
              title="Navn"
            />
            <Input
              id="demo-company"
              type="text"
              label="Firma navn"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoComplete="organization"
              maxLength={120}
              placeholder="Dit firmanavn"
              title="Firma navn"
            />
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" size="lg" fullWidth loading={isSaving}>
              {isSaving ? 'Gemmer...' : 'Fortsæt til appen'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-label text-text-secondary dark:text-text-dark-secondary mt-6">
          Vi bruger kun oplysningerne til at tilpasse din demo.
        </p>
      </div>
    </div>
  );
};

export default DemoWelcomePage;
