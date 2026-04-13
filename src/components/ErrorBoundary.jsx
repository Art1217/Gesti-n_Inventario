import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <span className="text-red-400 text-3xl font-bold">!</span>
            </div>
            <h1 className="text-white text-xl font-bold mb-2">Algo salió mal</h1>
            <p className="text-gray-500 text-sm mb-6">
              {this.state.error?.message ?? 'Error inesperado. Recarga la página para continuar.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Recargar Página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
