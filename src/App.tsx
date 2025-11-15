import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AdminLoginPage from "./pages/AdminLoginPage";
import EditorPage from "./pages/EditorPage";
import GamePage from "./pages/GamePage";
import ProtectedRoute from "./components/ProtectedRoute";

function App(): JSX.Element {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 text-6xl animate-bounce">🎮</div>
          <div className="text-2xl font-bold text-brandStart">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public game route - players can play published levels from Supabase */}
      <Route path="/" element={<GamePage />} />

      {/* Admin login */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Protected editor route (admin only) - Uses new EditorPage with Supabase */}
      <Route
        path="/admin/editor"
        element={
          <ProtectedRoute requireAdmin>
            <EditorPage />
          </ProtectedRoute>
        }
      />

      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
