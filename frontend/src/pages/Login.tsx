import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Pick up the "session expired" marker from the api client interceptor and
  // surface it to the user, so a 401 mid-action no longer feels like a silent
  // failure. Read+clear in a lazy initializer so StrictMode's double-invoke
  // doesn't lose the message between mounts.
  const [info, setInfo] = useState(() => {
    if (sessionStorage.getItem('gc_session_expired') === '1') {
      sessionStorage.removeItem('gc_session_expired');
      return 'Your session expired. Please sign in again.';
    }
    return '';
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      // App.tsx handles the post-login redirect (back to gc_return_to if set,
      // otherwise dashboard) once the token state flips.
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/goodman-classic-logo.jpg"
            alt="Goodman Classic Buildings & Equipment"
            className="w-56 mx-auto mb-4"
          />
          <div className="h-1 w-24 bg-primary-600 mx-auto mb-4 rounded-full" />
          <h1 className="text-2xl font-bold text-gray-900">GC Business Hub</h1>
          <p className="text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          {info && !error && (
            <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg">
              {info}
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
