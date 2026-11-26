import {Component} from 'react';

/** Keeps one failing page from blanking the whole app; resets when `resetKey` (the route) changes. */
export default class ErrorBoundary extends Component {
  state = {error: null};
  static getDerivedStateFromError(error) { return {error}; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({error: null}); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="max-w-xl mx-auto p-8 text-center glass mt-8">
        <h1 className="text-lg font-bold text-emerald-900">Something went wrong on this page</h1>
        <p className="text-sm text-slate-600 mt-1">The rest of the app still works. Try another page or reload.</p>
        <button onClick={() => this.setState({error: null})} className="mt-4 px-4 py-2 rounded-full bg-emerald-700 text-white text-sm hover:bg-emerald-800">Try again</button>
      </div>
    );
  }
}
