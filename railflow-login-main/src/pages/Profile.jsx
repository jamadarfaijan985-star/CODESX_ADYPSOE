import {
  ArrowRightIcon,
  BadgeCheckIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext.jsx";
import AppNav from "../components/AppNav.jsx";

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Profile() {
  const { user, logout, adapterMode, apiUrl } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    const result = await logout();
    if (result.serverConfirmed) {
      toast.success("Signed out.");
    } else {
      toast.warning("Signed out locally — the server could not be reached.");
    }
    navigate("/login", { replace: true });
  }

  const details = [
    ["Full name", user?.name || "—"],
    ["Email", user?.email || "—"],
    ["Account ID", user?.id || "—"],
    ["Role", user?.role || "operator"],
    [
      "Email status",
      user?.verified ? "Verified" : "Verification pending",
    ],
    [
      "Member since",
      user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—",
    ],
    [
      "Authentication",
      adapterMode === "mock"
        ? "Development mock adapter"
        : `REST API${apiUrl ? ` · ${apiUrl}` : ""}`,
    ],
  ];

  return (
    <motion.div
      className="rf-dash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AppNav />

      <main className="rf-dash__main rf-dash__main--narrow">
        <header className="rf-dash__head">
          <div>
            <p className="rf-kicker">§ Account — profile</p>
            <h1>Account Profile</h1>
            <p className="rf-dash__sub">
              Your operator identity for the RailFlow console.
            </p>
          </div>
          <Link className="rf-btn rf-btn--ghost" to="/dashboard">
            Back to dashboard <ArrowRightIcon aria-hidden="true" />
          </Link>
        </header>

        <section className="rf-panel rf-panel--profile">
          <header className="rf-panel__head">
            <span>P-A1 · User details</span>
            <span>
              {user?.verified ? (
                <span className="rf-verified">
                  <BadgeCheckIcon aria-hidden="true" /> Verified
                </span>
              ) : (
                "Pending"
              )}
            </span>
          </header>

          <div className="rf-panel__body">
            <div className="rf-profile">
              <span className="rf-avatar rf-avatar--xl" aria-hidden="true">
                {initials(user?.name)}
              </span>
              <div className="rf-profile__id">
                <h2>{user?.name}</h2>
                <p>{user?.email}</p>
              </div>
            </div>

            <dl className="rf-details">
              {details.map(([label, value]) => (
                <div className="rf-details__row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rf-actions">
              <Link className="rf-btn rf-btn--ghost" to="/settings">
                <SettingsIcon aria-hidden="true" /> Account Settings
              </Link>
              <button
                type="button"
                className="rf-btn rf-btn--danger"
                onClick={handleLogout}
              >
                <LogOutIcon aria-hidden="true" /> Logout
              </button>
            </div>
          </div>
        </section>
      </main>
    </motion.div>
  );
}
