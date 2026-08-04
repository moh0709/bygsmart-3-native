import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-bg-subtle dark:bg-bg-dark px-6 py-12">
      <p className="text-display text-brand-primary tabular-nums" aria-hidden="true">
        404
      </p>
      <EmptyState
        title="Siden blev ikke fundet"
        description="Linket kan være forældet, eller siden er blevet flyttet. Gå tilbage til forsiden og find det, du leder efter."
        action={<Button onClick={() => navigate('/home')}>Til forsiden</Button>}
        className="py-4"
      />
    </div>
  );
};

export default NotFoundPage;
