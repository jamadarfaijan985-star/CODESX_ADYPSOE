import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import AppNav from "../components/AppNav.jsx";

const PLATFORMS = [
  { id: "P1", service: "IC 204 → Northport", state: "Boarding", tone: "go" },
  { id: "P2", service: "RE 118 → Airport T2", state: "On time", tone: "go" },
  { id: "P3", service: "IC 512 → Harbour", state: "Held", tone: "hold" },
  { id: "P4", service: "S4 → Westgate", state: "Idle", tone: "idle" },
  { id: "P5", service: "RE 203 → Valley Park", state: "Boarding", tone: "go" },
  { id: "P6", service: "IC 907 → Summit", state: "+4 min", tone: "hold" },
];

const NOTICES = [
  {
    tag: "Minor",
    tone: "hold",
    text: "Signalling check on P3 — residual delay of 4 minutes for IC 512.",
  },
  {
    tag: "Cleared",
    tone: "go",
    text: "Overhead line inspection finished on the north approach.",
  },
  {
    tag: "Info",
    tone: "idle",
    text: "Allocation engine is running in placeholder mode in this build.",
  },
];

const STATS = [
  { value: "74%", label: "Occupancy" },
  { value: "18", label: "Active services" },
  { value: "02", label: "Open incidents" },
];

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Operations dashboard (protected). Preserves the existing platform
 * allocation, disruption and network-status views from the original build.
 */
export default function Dashboard() {
  const { user, adapterMode } = useAuth();
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  const firstName = (user?.name || "operator").split(" ")[0];

  return (
    <motion.div
      className="rf-dash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AppNav />

      <main className="rf-dash__main">
        <header className="rf-dash__head">
          <div>
            <p className="rf-kicker">§ Dashboard — placeholder build</p>
            <h1>Operations Overview</h1>
            <p className="rf-dash__sub">
              Welcome back, {firstName}. Platform allocation &amp; disruption
              control for Central Junction.
            </p>
          </div>
          <div className="rf-clock">
            <p className="rf-kicker">Local time</p>
            <span className="rf-clock__val">{clock}</span>
          </div>
        </header>

        <section className="rf-grid" aria-label="Dashboard panels">
          <article className="rf-panel">
            <header className="rf-panel__head">
              <span>P-01 · Platform allocation</span>
              <span>Live board</span>
            </header>
            <div className="rf-panel__body">
              {PLATFORMS.map((platform) => (
                <div className="rf-row" key={platform.id}>
                  <span className="rf-row__id">{platform.id}</span>
                  <span className="rf-row__svc">{platform.service}</span>
                  <span className={`rf-chip rf-chip--${platform.tone}`}>
                    {platform.state}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="rf-panel">
            <header className="rf-panel__head">
              <span>P-02 · Disruption management</span>
              <span>3 notices</span>
            </header>
            <div className="rf-panel__body">
              {NOTICES.map((notice) => (
                <div className="rf-notice" key={notice.text}>
                  <span className={`rf-chip rf-chip--${notice.tone}`}>
                    {notice.tag}
                  </span>
                  <p>{notice.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rf-panel">
            <header className="rf-panel__head">
              <span>P-03 · Network status</span>
              <span>Shift A</span>
            </header>
            <div className="rf-panel__body rf-stats">
              {STATS.map((stat) => (
                <div className="rf-stat" key={stat.label}>
                  <span className="rf-stat__val">{stat.value}</span>
                  <span className="rf-stat__lbl">{stat.label}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <p className="rf-placeholder-note">
          <b>Placeholder view</b> — the allocation engine, live feeds and
          incident workflows are not wired up in this frontend build. Your
          session is validated by the auth service (
          {adapterMode === "mock"
            ? "development mock adapter"
            : "REST API"}{" "}
          ) and cleared on logout.
        </p>
      </main>
    </motion.div>
  );
}
