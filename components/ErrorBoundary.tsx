import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleClearStorageAndReload = () => {
    try {
      localStorage.removeItem('emptyContainersDataV3');
      localStorage.removeItem('wh_distribution_justifications');
      localStorage.removeItem('gen_wh_distribution_justifications');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-container" className="min-h-[400px] w-full flex flex-col items-center justify-center p-8 bg-slate-50/80 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight mb-2">
            {this.props.fallbackTitle || "An unexpected error occurred in this view"}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || "The application encountered an issue while processing or rendering this component. You can reload the view or clear temporary storage."}
          </p>

          <div className="flex items-center gap-3">
            <button
              id="error-boundary-retry-btn"
              onClick={this.handleReload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry View</span>
            </button>
            <button
              id="error-boundary-clear-storage-btn"
              onClick={this.handleClearStorageAndReload}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset & Reload App</span>
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mt-6 text-left max-w-2xl w-full bg-slate-900 text-slate-200 p-4 rounded-xl text-[11px] font-mono overflow-auto max-h-48">
              <summary className="cursor-pointer text-slate-400 font-bold mb-2">Technical Details</summary>
              <p className="text-rose-400">{this.state.error.toString()}</p>
              <pre className="mt-2 text-slate-500 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
