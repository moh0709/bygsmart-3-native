import React from 'react';
import { AlertTriangleIcon } from '../../../components/icons';
import { Alert } from '../../../components/ui';

interface SafetyDisclaimerProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/** Safety notice for advisory calculations — kit `Alert` on the danger tone. */
const SafetyDisclaimer: React.FC<SafetyDisclaimerProps> = ({
  title = 'VIGTIGT: Vejledende Beregning',
  children,
  className = '',
}) => (
  <Alert
    variant="danger"
    title={title}
    icon={<AlertTriangleIcon className="w-5 h-5" />}
    className={className}
  >
    <div className="leading-relaxed">{children}</div>
  </Alert>
);

export default SafetyDisclaimer;
