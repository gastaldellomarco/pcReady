import React from "react";
import { PageFetchError } from "@/components/page-states/PageStates";

type Props = {
  children: React.ReactNode;
  variant?: "app" | "portal";
};

type State = { error: Error | null };

/**
 *
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  /**
   *
   */
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /**
   *
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("PageErrorBoundary:", error, info.componentStack);
  }

  /**
   *
   */
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <PageFetchError
          variant={this.props.variant ?? "app"}
          title="Errore di interfaccia"
          message={error.message || "Si è verificato un errore imprevisto durante il rendering."}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
