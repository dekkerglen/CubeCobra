import React, { Component, Fragment, ReactNode } from 'react';
import { Card, Container } from 'reactstrap';

interface ErrorBoundaryProps {
  className?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
  stack: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = { hasError: false, error: '', stack: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error.message, stack: error.stack ?? '' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // TODO: Set up network error-logging service so we know if there are UI bugs.
    console.error(error, errorInfo);
  }

  render(): ReactNode {
    const { hasError, error, stack } = this.state;
    const { className, children } = this.props;
    if (hasError) {
      return (
        <div className={className ?? 'mt-3'}>
          <h1 className="text-center">Something went wrong.</h1>
          <p className="text-center">You may want to try reloading the page.</p>
          <br />
          <Container>
            <Card>
              <p>
                <code>{error}</code>
              </p>
              <p>
                <code>
                  {stack.split('\n').map((text, index) => (
                    <Fragment key={index}>
                      {text}
                      <br />
                    </Fragment>
                  ))}
                </code>
              </p>
            </Card>
          </Container>
        </div>
      );
    }
    return children;
  }
}

export default ErrorBoundary;
