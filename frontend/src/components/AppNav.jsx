import { Link } from "react-router";
import UserMenu from "./UserMenu.jsx";

/** Shared top navigation for authenticated pages. */
export default function AppNav({
  station = "Station: Central Junction",
}) {
  return (
    <nav className="rf-nav" aria-label="RailFlow navigation">
      <Link to="/dashboard" className="rf-nav__brand">
        <span className="rf-nav__mark" aria-hidden="true" />
        <span className="rf-nav__word">
          RAIL<span>FLOW</span>
        </span>
      </Link>
      <span className="rf-badge rf-badge--sm">{station}</span>
      <div className="rf-nav__right">
        <UserMenu />
      </div>
    </nav>
  );
}
