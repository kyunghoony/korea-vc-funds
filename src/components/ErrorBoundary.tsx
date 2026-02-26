import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" role="alert">
          <div className="empty-title">문제가 발생했습니다</div>
          <div className="empty-desc">
            {this.state.error?.message || "알 수 없는 오류가 발생했습니다"}
          </div>
          <button
            className="empty-reset"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.hash = "#/";
              window.location.reload();
            }}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
