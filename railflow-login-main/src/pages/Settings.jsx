import { ArrowRightIcon, LogOutIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext.jsx";
import AppNav from "../components/AppNav.jsx";
import { getPref, setPref } from "../lib/prefs.js";
import { Switch } from "@/components/ui/switch";

function SettingRow({ id, title, description, children }) {
  return (
    <div className="rf-setting">
      <div className="rf-setting__text">
        <label htmlFor={id}>{title}</label>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { logout, adapterMode } = useAuth();
  const navigate = useNavigate();

  const [reduceMotion, setReduceMotion] = useState(() =>
    getPref("reduceMotion"),
  );
  const [rememberDefault, setRememberDefault] = useState(() =>
    getPref("rememberDefault"),
  );

  function toggleReduceMotion(checked) {
    setReduceMotion(checked);
    setPref("reduceMotion", checked);
    toast.success(
      checked
        ? "Reduced motion enabled on this device."
        : "Animations restored.",
    );
  }

  function toggleRememberDefault(checked) {
    setRememberDefault(checked);
    setPref("rememberDefault", checked);
    toast.success(
      checked
        ? "Remember me will be checked by default."
        : "Remember me will be unchecked by default.",
    );
  }

  async function handleLogout() {
    const result = await logout();
    if (result.serverConfirmed) {
      toast.success("Signed out.");
    } else {
      toast.warning("Signed out locally — the server could not be reached.");
    }
    navigate("/login", { replace: true });
  }

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
            <p className="rf-kicker">§ Account — settings</p>
            <h1>Account Settings</h1>
            <p className="rf-dash__sub">
              Preferences stored on this device ({adapterMode} adapter).
            </p>
          </div>
          <Link className="rf-btn rf-btn--ghost" to="/dashboard">
            Back to dashboard <ArrowRightIcon aria-hidden="true" />
          </Link>
        </header>

        <section className="rf-panel">
          <header className="rf-panel__head">
            <span>S-01 · Experience</span>
            <span>Local</span>
          </header>
          <div className="rf-panel__body">
            <SettingRow
              id="pref-reduce-motion"
              title="Reduce motion"
              description="Turn off decorative animations and screen transitions (also follows your OS setting)."
            >
              <Switch
                id="pref-reduce-motion"
                checked={reduceMotion}
                onCheckedChange={toggleReduceMotion}
              />
            </SettingRow>

            <SettingRow
              id="pref-remember"
              title="Remember me by default"
              description="Pre-checks the Remember me box on the sign-in screen."
            >
              <Switch
                id="pref-remember"
                checked={rememberDefault}
                onCheckedChange={toggleRememberDefault}
              />
            </SettingRow>
          </div>
        </section>

        <section className="rf-panel">
          <header className="rf-panel__head">
            <span>S-02 · Notifications</span>
            <span>Requires backend</span>
          </header>
          <div className="rf-panel__body">
            <SettingRow
              id="pref-disruption-alerts"
              title="Disruption email alerts"
              description="Disabled until the backend exposes a preferences endpoint (not part of the proposed auth API)."
            >
              <Switch id="pref-disruption-alerts" disabled />
            </SettingRow>
          </div>
        </section>

        <section className="rf-panel rf-panel--danger">
          <header className="rf-panel__head">
            <span>S-03 · Session</span>
            <span>Security</span>
          </header>
          <div className="rf-panel__body">
            <div className="rf-setting">
              <div className="rf-setting__text">
                <label>Sign out of this device</label>
                <p>
                  Ends your session with the auth service and clears stored
                  tokens.
                </p>
              </div>
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
