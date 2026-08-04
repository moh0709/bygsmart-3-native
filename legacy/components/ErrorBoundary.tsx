import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Card } from './ui/Card';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const isDev = import.meta.env.DEV;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack,
        },
      },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-subtle dark:bg-bg-dark p-6">
          <Card padding="lg" className="max-w-md w-full">
            <Alert variant="danger" title="Noget gik galt">
              Der opstod en uventet fejl. Prov at genindlaese appen.
            </Alert>
            {isDev && this.state.error && (
              <pre className="text-xs bg-bg-muted dark:bg-bg-dark-muted rounded-control p-3 text-left overflow-auto mt-4 text-danger-strong dark:text-danger">
                {this.state.error.message}
              </pre>
            )}
            <Button fullWidth className="mt-6" onClick={this.handleReset}>
              Ga til forsiden
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;