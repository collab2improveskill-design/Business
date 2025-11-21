
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen text-center p-4 bg-gray-50 max-w-md mx-auto">
            <AlertTriangle className="w-16 h-16 mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong.</h1>
            <p className="text-gray-600 mb-6">We encountered an unexpected error. Please try reloading.</p>
            <button 
                onClick={this.handleRefresh}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-lg"
            >
                Reload App
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
