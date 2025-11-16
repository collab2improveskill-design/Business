import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-screen text-center p-4 bg-gray-50 max-w-md mx-auto">
            <AlertTriangle className="w-16 h-16 mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong.</h1>
            <p className="text-gray-600 mb-6">We're sorry for the inconvenience. Please try refreshing the page.</p>
            <button
                onClick={this.handleRefresh}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
            >
                Refresh Page
            </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
