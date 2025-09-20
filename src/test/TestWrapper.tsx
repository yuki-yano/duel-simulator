import React, { type ReactNode, Component, type ErrorInfo } from 'react'
import { Provider } from 'jotai'

interface TestWrapperProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <h2>Something went wrong</h2>
          {this.state.error && <pre>{this.state.error.message}</pre>}
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * テスト用のWrapperコンポーネント
 * Jotai Providerやエラーバウンダリを提供する
 *
 * @example
 * ```tsx
 * render(
 *   <TestWrapper>
 *     <MyComponent />
 *   </TestWrapper>
 * )
 * ```
 */
export function TestWrapper({
  children,
  onError
}: TestWrapperProps): React.JSX.Element {
  return (
    <Provider>
      <ErrorBoundary onError={onError}>
        {children}
      </ErrorBoundary>
    </Provider>
  )
}
