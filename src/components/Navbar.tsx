import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { logError } from "../utils/logger";

export default function Navbar(): JSX.Element {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      logError("Error signing out", error);
    }
  };

  return (
    <nav className="bg-gradient-to-br from-brandStart to-brandEnd px-6 py-4 text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-2xl font-bold hover:opacity-90 transition">
          <span>🎮</span>
          <span>The Lost Prison</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2">
                <span className="text-sm font-medium">
                  {profile?.username || user.email}
                </span>
                {profile?.role === 'admin' && (
                  <span className="rounded-full bg-yellow-400 px-2 py-1 text-xs font-bold text-slate-900">
                    ADMIN
                  </span>
                )}
              </div>

              {profile?.role === 'admin' && (
                <Link
                  to="/admin/editor"
                  className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 font-semibold transition hover:bg-white/30"
                >
                  <span>📝</span>
                  <span>Editor</span>
                </Link>
              )}

              <button
                onClick={handleSignOut}
                className="rounded-lg bg-white/20 px-4 py-2 font-semibold transition hover:bg-white/30"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/admin/login"
              className="rounded-lg bg-white/20 px-4 py-2 font-semibold transition hover:bg-white/30"
            >
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
