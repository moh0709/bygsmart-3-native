import React, { useState } from 'react';
import { useToolAccess } from '../../../contexts/ToolAccessProvider';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { Badge, Button, Card } from '../../../components/ui';
import { CheckIcon, LockIcon, SparklesIcon } from '../../../components/icons';

interface ProToolGateProps {
  toolId: string;
  children: React.ReactNode;
  /** Content to render when the tool is locked. Defaults to the Pro upsell card. */
  fallback?: React.ReactNode;
}

// ── Upsell card ─────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  'Adgang til alle Pro-beregnere',
  'Branded PDF-rapporter til kunder og tilsyn',
  'Gem beregninger direkte til dine projekter',
];

/** Locked-state upsell: lock icon bubble, feature list and one primary CTA. */
export const ProUpsellCard: React.FC<{ className?: string }> = ({ className }) => {
  const { upgradeTo } = useSubscription();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      await upgradeTo('PRO');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Card padding="lg" className={className}>
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-brand-subtle dark:bg-brand-subtle-dark flex items-center justify-center mb-3">
          <LockIcon className="w-6 h-6 text-brand-primary dark:text-brand-light" />
        </div>
        <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Pro-værktøj</h3>
        <p className="mt-1 text-label text-text-secondary dark:text-text-dark-secondary">
          Dette værktøj kræver et Pro-abonnement.
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {PRO_FEATURES.map(feature => (
          <li key={feature} className="flex items-start gap-2 text-label text-text-secondary dark:text-text-dark-secondary">
            <CheckIcon className="w-4 h-4 mt-0.5 shrink-0 text-success" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        fullWidth
        className="mt-5"
        loading={isUpgrading}
        onClick={handleUpgrade}
        iconLeft={<SparklesIcon className="w-4 h-4" />}
        aria-label="Opgrader til Pro"
      >
        Opgrader til Pro
      </Button>
    </Card>
  );
};

// ── Gate ─────────────────────────────────────────────────────────────────────

/**
 * Wraps content that should only be visible/accessible for a given tool.
 * When the tool is locked (pro-locked), renders `fallback` — or the standard
 * Pro upsell card when no fallback is provided.
 */
const ProToolGate: React.FC<ProToolGateProps> = ({ toolId, children, fallback }) => {
  const { allowed } = useToolAccess(toolId);
  if (allowed) return <>{children}</>;
  return <>{fallback !== undefined ? fallback : <ProUpsellCard />}</>;
};

export default ProToolGate;

// ── Campaign badge ─────────────────────────────────────────────────────────

export const CampaignBadge: React.FC<{ campaignUntil: string }> = ({ campaignUntil }) => {
  const formatted = React.useMemo(() => {
    try {
      return new Date(campaignUntil).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    } catch {
      return campaignUntil;
    }
  }, [campaignUntil]);

  return <Badge variant="success">Gratis til {formatted}</Badge>;
};

// ── Lock badge ──────────────────────────────────────────────────────────────

export const LockBadge: React.FC = () => (
  <Badge variant="neutral">
    <LockIcon className="w-3 h-3" aria-hidden="true" />
    Pro
  </Badge>
);

// ── useAdvancedLocked convenience hook ─────────────────────────────────────

export const useAdvancedLocked = (toolId: string): boolean => {
  const { advancedAllowed } = useToolAccess(toolId);
  return !advancedAllowed;
};
