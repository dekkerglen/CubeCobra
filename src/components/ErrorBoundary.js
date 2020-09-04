import React, { Component } from 'react';
import { Card, Container } from 'reactstrap';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = { hasError: false, error: '', stack: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error.message, stack: error.stack };
  }

  componentDidCatch(error, errorInfo) {
    // TODO: Set up network error-logging service so we know if there are UI bugs.
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={'mt-3' || this.props.className}>
          <h1 className="text-center">Something went wrong.</h1>
          <p className="text-center">You may want to try reloading the page.</p>
          <br />
          <Container>
            <Card>
              <p>
                <code>{this.state.error}</code>
              </p>
              <p>
                <code>
                  {this.state.stack.split('\n').map((text) => (
                    <>
                      {text}
                      <br />
                    </>
                  ))}
                </code>
              </p>
            </Card>
          </Container>
        </div>
      );
    } else {
      return this.props.children;
    }
  }
}

export default ErrorBoundary;
