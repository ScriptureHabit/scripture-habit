import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
    // Report to Sentry if available globally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentry = (window as any).Sentry;
    if (sentry && typeof sentry.captureException === 'function') {
      sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="App error-screen-root">
          <div className="AppGlass error-glass-card-root">
            <h1 className="error-emoji-root">🛸</h1>
            <h2 className="error-title-root">Something went wrong.</h2>
            <p className="error-desc-root">We've been notified and are looking into it.</p>
            <button 
              onClick={this.handleReset}
              className="error-reload-btn-root"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
