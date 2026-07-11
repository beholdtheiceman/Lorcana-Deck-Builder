import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ borderColor: 'color-mix(in srgb, var(--ruby) 30%, var(--line))', background: 'color-mix(in srgb, var(--ruby) 6%, var(--panel))' }}
        >
          <p className="font-display mb-1" style={{ fontWeight: 560, color: 'var(--ruby)' }}>Something went wrong</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border text-sm transition-colors hover:brightness-110"
            style={{ borderColor: 'color-mix(in srgb, var(--ruby) 40%, transparent)', background: 'color-mix(in srgb, var(--ruby) 12%, transparent)', color: 'var(--ruby)' }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
