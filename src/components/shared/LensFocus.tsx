import { cn } from "@/lib/utils";

/**
 * Decorative lens-focus graphic: optic rings, a slowly turning dashed ring and
 * rays converging on a focal point. Drawn over a photograph, so it is hidden
 * from assistive technology and carries no information of its own.
 *
 * Geometry is computed once at module load. Motion is CSS: rays draw in,
 * the focal point pulses and the dashed ring turns, all behind `motion-safe:`.
 */

const CENTRE = 200;
const OUTER_RADIUS = 186;
const INNER_RADIUS = 96;
const RAY_COUNT = 8;

const RAYS = Array.from({ length: RAY_COUNT }, (_, index) => {
  const angle = (index / RAY_COUNT) * Math.PI * 2 - Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: CENTRE + OUTER_RADIUS * cos,
    y1: CENTRE + OUTER_RADIUS * sin,
    x2: CENTRE + INNER_RADIUS * cos,
    y2: CENTRE + INNER_RADIUS * sin,
    delay: `${(index * 0.12).toFixed(2)}s`,
  };
});

export function LensFocus({ className }: { className?: string }) {
  const origin = { transformOrigin: `${CENTRE}px ${CENTRE}px` };

  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={cn("overflow-visible", className)}
      aria-hidden
      focusable="false"
    >
      <g
        className="motion-safe:spin-orbit"
        style={origin}
        strokeWidth="1"
        strokeDasharray="2 9"
        opacity="0.55"
      >
        <circle cx={CENTRE} cy={CENTRE} r={OUTER_RADIUS + 10} />
      </g>

      <g strokeWidth="1.25" opacity="0.7">
        <circle cx={CENTRE} cy={CENTRE} r={INNER_RADIUS + 26} />
        <circle cx={CENTRE} cy={CENTRE} r={INNER_RADIUS} />
      </g>

      <g strokeWidth="1.4" opacity="0.85">
        {RAYS.map((ray, index) => (
          <line
            key={index}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            pathLength={1}
            className="ray-draw"
            style={{ "--delay": ray.delay } as React.CSSProperties}
          />
        ))}
      </g>

      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={6}
        fill="currentColor"
        stroke="none"
        className="motion-safe:pulse-ping"
        style={origin}
      />
      <circle cx={CENTRE} cy={CENTRE} r={6} fill="currentColor" stroke="none" />
    </svg>
  );
}
