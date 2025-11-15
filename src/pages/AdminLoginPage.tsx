import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { logError } from "../utils/logger";

export default function AdminLoginPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in as admin
  useEffect(() => {
    if (user && profile?.role === 'admin') {
      navigate("/admin/editor");
    } else if (user && profile?.role === 'player') {
      navigate("/");
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      // Navigation will happen via useEffect after auth state updates
    } catch (err: any) {
      logError("Login failed", err);
      // SECURITY: Generic error message to prevent user enumeration
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-4xl font-bold hover:opacity-80 transition">
            <span>🎮</span>
            <span className="bg-gradient-to-r from-brandStart to-brandEnd bg-clip-text text-transparent">
              The Lost Prison
            </span>
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mb-3 text-5xl">🔐</div>
            <h1 className="text-3xl font-bold text-slate-800">Admin Login</h1>
            <p className="mt-2 text-slate-600">
              Sign in to access the level editor
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border-2 border-slate-200 p-3 focus:border-brandStart focus:outline-none transition"
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border-2 border-slate-200 p-3 focus:border-brandStart focus:outline-none transition"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-br from-brandStart to-brandEnd py-3 font-semibold text-white transition hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>Signing in...</span>
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              Players don't need an account.{' '}
              <Link to="/" className="font-semibold text-brandStart hover:underline">
                Just play!
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          <p>🔒 Secure authentication powered by Supabase</p>
        </div>
      </div>
    </div>
  );
}
