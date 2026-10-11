import { Loader2Icon } from "lucide-react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext.jsx";
import { safeReturnTo } from "../lib/validation.js";

export function RouteLoader({ label = "Restoring session…" }) {
  return (
    <div className="rf-loader" role="status">
      <Loader2Icon className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Protected app pages — signed-out visitors go to /login with a return path. */
export function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <RouteLoader />;
  if (status !== "authenticated") {
    const from = encodeURIComponent(
      `${location.pathname}${location.search}`,
    );
    return <Navigate to={`/login?returnTo=${from}`} replace />;
  }
  return children;
}

/** Auth screens — already-signed-in users bounce to their destination. */
export function PublicOnlyRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <RouteLoader />;
  if (status === "authenticated") {
    const params = new URLSearchParams(location.search);
    return <Navigate to={safeReturnTo(params.get("returnTo"))} replace />;
  }
  return children;
}

/** `/` — route by session state. */
export function RootRedirect() {
  const { status } = useAuth();
  if (status === "loading") return <RouteLoader />;
  return (
    <Navigate
      to={status === "authenticated" ? "/dashboard" : "/login"}
      replace
    />
  );
}
