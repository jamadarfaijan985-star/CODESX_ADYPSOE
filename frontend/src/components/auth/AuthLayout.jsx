import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "../../auth/AuthContext.jsx";
import AuthLogo from "./AuthLogo.jsx";
import RailBackground from "./RailBackground.jsx";

/**
 * Shared shell for every authentication screen: animated railway background,
 * fixed console chrome and a Framer Motion transition between screens.
 */
export default function AuthLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { adapterMode } = useAuth();

  return (
    <div className="rf-screen rf-auth">
      <RailBackground />
      <div className="rf-frame" aria-hidden="true" />

      <header className="rf-statusbar">
        <Link to="/" className="rf-statusbar__brand">
          <AuthLogo size="xs" />
          <span className="rf-wordmark rf-wordmark--sm">
            RAIL<span className="rf-wordmark__accent">FLOW</span>
          </span>
        </Link>
        <span className="rf-statusbar__mid">
          <span className="rf-led" aria-hidden="true" />
          Link active
        </span>
        <span>
          {adapterMode === "mock"
            ? "Dev mock adapter · no backend"
            : "Secure API · session encrypted"}
        </span>
      </header>

      <main className="rf-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="rf-auth__slot"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.99 }}
            transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="rf-pagefoot">
        RailFlow — AI-powered railway disruption management ·{" "}
        {adapterMode === "mock"
          ? "development mock authentication"
          : "server-side sessions"}
      </footer>
    </div>
  );
}
