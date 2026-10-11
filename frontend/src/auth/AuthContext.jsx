import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authService from "../services/authService.js";

const AuthContext = createContext(null);

/**
 * Session state for the whole app.
 * Boot: restores the persisted session via GET /api/auth/me (or the labeled
 * development mock when no backend is configured). Failures degrade safely to
 * "unauthenticated" — never to a fake logged-in state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | unauthenticated

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const restored = await authService.getSession();
        if (!alive) return;
        setUser(restored);
        setStatus(restored ? "authenticated" : "unauthenticated");
      } catch {
        // Server unreachable — treat as signed out; login will retry later.
        if (!alive) return;
        setUser(null);
        setStatus("unauthenticated");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await authService.login(credentials);
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const result = await authService.logout();
    setUser(null);
    setStatus("unauthenticated");
    return result;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const next = await authService.getSession();
      setUser(next);
      setStatus(next ? "authenticated" : "unauthenticated");
      return next;
    } catch {
      return null;
    }
  }, []);

  const register = useCallback((input) => authService.register(input), []);
  const verifyEmail = useCallback((input) => authService.verifyEmail(input), []);
  const resendVerification = useCallback(
    (input) => authService.resendVerification(input),
    [],
  );
  const forgotPassword = useCallback(
    (input) => authService.forgotPassword(input),
    [],
  );
  const resetPassword = useCallback(
    (input) => authService.resetPassword(input),
    [],
  );
  const inspectResetToken = useCallback(
    (token) => authService.inspectResetToken(token),
    [],
  );

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated",
      adapterMode: authService.adapterMode,
      apiUrl: authService.apiUrl,
      login,
      logout,
      register,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      inspectResetToken,
      refreshUser,
    }),
    [
      user,
      status,
      login,
      logout,
      register,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      inspectResetToken,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
