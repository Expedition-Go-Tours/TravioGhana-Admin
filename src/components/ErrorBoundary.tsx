import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-status-rejected/10 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-status-rejected" />
          </div>
          <h3 className="text-lg font-medium text-text-primary">Something went wrong</h3>
          <p className="mt-1 text-sm text-text-secondary">{this.state.error?.message || "An unexpected error occurred"}</p>
          <Button variant="outline" className="mt-4" onClick={() => this.setState({ hasError: false, error: undefined })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </div>
      );
    }
  }
}