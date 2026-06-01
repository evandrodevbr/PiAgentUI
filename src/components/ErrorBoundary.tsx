import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  private handleCopy = () => {
    if (!this.state.error) return
    const text = `Error: ${this.state.error.message}\nStack: ${this.state.error.stack}\nComponent Stack: ${this.state.errorInfo?.componentStack}`
    navigator.clipboard.writeText(text)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleResetRoute = () => {
    window.location.hash = '/'
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#1a1b26] p-6 font-sans text-[#a9b1d6]">
          <div className="w-full max-w-3xl rounded-lg border border-[#f7768e]/30 bg-[#24283b] p-8 shadow-2xl">
            <h1 className="mb-4 text-2xl font-bold text-[#f7768e] flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Application Crash Detected
            </h1>
            <p className="mb-6 text-sm text-[#787c99]">
              An unexpected error occurred during rendering. Please review the details below.
            </p>

            <div className="mb-6 overflow-hidden rounded bg-[#1f2335] border border-[#3b4261]">
              <div className="flex items-center justify-between bg-[#1a1b26] px-4 py-2 text-xs font-semibold text-[#737aa2] border-b border-[#3b4261]">
                <span>Error Message</span>
                <button
                  onClick={this.handleCopy}
                  className="rounded px-2 py-1 hover:bg-[#24283b] hover:text-[#7aa2f7] transition-colors"
                >
                  Copy Details
                </button>
              </div>
              <pre className="max-h-[300px] overflow-auto p-4 text-xs font-mono text-[#f7768e] whitespace-pre-wrap">
                {this.state.error?.toString()}
                {this.state.error?.stack && `\n\nStack Trace:\n${this.state.error.stack}`}
                {this.state.errorInfo?.componentStack && `\n\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={this.handleReload}
                className="flex-1 rounded bg-[#7aa2f7] py-2 text-sm font-semibold text-[#1a1b26] hover:bg-[#89ddff] transition-colors cursor-pointer text-center"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleResetRoute}
                className="flex-1 rounded border border-[#7aa2f7] py-2 text-sm font-semibold text-[#7aa2f7] hover:bg-[#7aa2f7]/10 transition-colors cursor-pointer text-center"
              >
                Reset Route to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
