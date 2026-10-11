/**
 * Animated railway scene behind the auth screens:
 * blueprint grid handled by the screen shell, plus glowing route lines,
 * platform nodes, drifting particles and moving train indicators.
 * All motion is decorative and stops under prefers-reduced-motion /
 * the in-app "Reduce motion" preference (html.rf-reduce-motion).
 */
const PARTICLES = [
  { left: "8%", top: "22%", size: 3, delay: 0 },
  { left: "18%", top: "68%", size: 2, delay: 1.4 },
  { left: "32%", top: "14%", size: 2, delay: 2.6 },
  { left: "46%", top: "82%", size: 3, delay: 0.8 },
  { left: "62%", top: "26%", size: 2, delay: 3.4 },
  { left: "74%", top: "72%", size: 3, delay: 1.9 },
  { left: "86%", top: "34%", size: 2, delay: 2.9 },
  { left: "94%", top: "64%", size: 3, delay: 0.4 },
];

export default function RailBackground() {
  return (
    <div className="rf-scene" aria-hidden="true">
      <svg
        className="rf-scene__routes"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <path
          className="rf-route rf-route--1"
          d="M-80 720 C 260 716, 380 560, 700 520 S 1180 420, 1520 380"
        />
        <path
          className="rf-route rf-route--2"
          d="M-80 180 C 300 210, 520 320, 740 470 S 1160 720, 1520 790"
        />
        <path
          className="rf-route rf-route--3"
          d="M-80 470 C 340 452, 640 448, 980 470 S 1340 520, 1520 540"
        />
        <g className="rf-nodes">
          <circle className="rf-node rf-node--hub" cx="700" cy="520" r="7" />
          <circle className="rf-node" cx="740" cy="470" r="5" />
          <circle className="rf-node" cx="380" cy="560" r="4" />
          <circle className="rf-node" cx="1180" cy="420" r="5" />
          <circle className="rf-node" cx="980" cy="470" r="4" />
          <circle className="rf-node" cx="340" cy="452" r="4" />
        </g>
        <g className="rf-halos">
          <circle className="rf-halo" cx="700" cy="520" r="16" />
          <circle className="rf-halo rf-halo--late" cx="1180" cy="420" r="14" />
        </g>
      </svg>

      <div className="rf-tracks">
        <div className="rf-track rf-track--1">
          <span className="rf-train rf-train--a" />
        </div>
        <div className="rf-track rf-track--2">
          <span className="rf-train rf-train--b" />
        </div>
        <div className="rf-track rf-track--3">
          <span className="rf-train rf-train--c" />
        </div>
      </div>

      <div className="rf-particles">
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="rf-particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
