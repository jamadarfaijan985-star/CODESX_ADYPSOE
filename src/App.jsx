import { MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext.jsx";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RootRedirect,
} from "./auth/guards.jsx";
import AuthLayout from "./components/auth/AuthLayout.jsx";
import { applyPrefs, getPref, PREFS_EVENT } from "./lib/prefs.js";
import Dashboard from "./pages/Dashboard.jsx";
import Profile from "./pages/Profile.jsx";
import Settings from "./pages/Settings.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import Login from "./pages/auth/Login.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import Signup from "./pages/auth/Signup.jsx";
import VerifyEmail from "./pages/auth/VerifyEmail.jsx";
import NotFound from "./pages/NotFound.tsx";

/** Bridges the "Reduce motion" preference into Framer Motion. */
function MotionPrefs({ children }) {
  const [reduce, setReduce] = useState(() => getPref("reduceMotion"));

  useEffect(() => {
    applyPrefs();
    const handleChange = (event) => {
      if (event.detail?.key === "reduceMotion") {
        setReduce(Boolean(event.detail.value));
      }
    };
    window.addEventListener(PREFS_EVENT, handleChange);
    return () => window.removeEventListener(PREFS_EVENT, handleChange);
  }, []);

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}

/**
 * Application root: motion preferences + auth session + route table.
 *   • Public auth screens  → /login /signup /forgot-password /reset-password /verify-email
 *   • Protected app pages  → /dashboard /profile /settings
 *   • `/` redirects by session state, everything else → 404
 */
export default function App() {
  return (
    <MotionPrefs>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route
            element={
              <PublicOnlyRoute>
                <AuthLayout />
              </PublicOnlyRoute>
            }
          >
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
          </Route>

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </MotionPrefs>
  );
}
