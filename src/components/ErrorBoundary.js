import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
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
        </div>
      );
    } else {
      return this.props.children;
    }
  }
}

export default ErrorBoundary;
