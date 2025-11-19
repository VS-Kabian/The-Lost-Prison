import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary component to catch and handle React rendering errors
 * Prevents entire app from crashing due to component errors
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development or monitoring service in production
    logError('React Error Boundary caught error', { error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-md text-center p-8 bg-white rounded-2xl shadow-2xl border-4 border-red-200">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-3xl font-bold text-red-600 mb-4">
              Oops! Something went wrong
            </h1>
            <p className="text-slate-600 mb-6">
              The application encountered an unexpected error.
              Don't worry, your progress is safe!
            </p>

            {this.state.error && (
              <details className="mb-6 text-left bg-slate-50 p-4 rounded-lg border border-slate-200">
                <summary className="cursor-pointer font-semibold text-slate-700 mb-2">
                  Error Details (for developers)
                </summary>
                <pre className="text-xs text-slate-600 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all hover:scale-105"
            >
              🔄 Reload Application
            </button>

            <p className="text-sm text-slate-500 mt-4">
              If this problem persists, please contact support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
