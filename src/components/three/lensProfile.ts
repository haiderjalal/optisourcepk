import * as THREE from "three";

/**
 * Builds the half-section profile of a biconvex lens blank for
 * `LatheGeometry`. Lathe spins the profile about the Y axis, so the
 * resulting solid has its optical axis on Y — rotate the mesh by π/2 on X
 * to face the camera.
 *
 *            ● (0, +centre)          front apex
 *          ╱
 *        ╱  ← curved front surface
 *   ────●  (radius, +edge)           edge band top
 *       │
 *   ────●  (radius, -edge)           edge band bottom
 *        ╲
 *          ● (0, -centre)            rear apex
 */
export function lensProfile({
  radius = 1,
  centreThickness = 0.34,
  edgeThickness = 0.09,
  segments = 24,
}: {
  radius?: number;
  centreThickness?: number;
  edgeThickness?: number;
  segments?: number;
} = {}): THREE.Vector2[] {
  const halfCentre = centreThickness / 2;
  const halfEdge = edgeThickness / 2;
  const points: THREE.Vector2[] = [];

  // Front surface: apex → edge, following a circular sag so the curvature
  // reads as a real surface rather than a cone.
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * radius;
    // Circular sag normalised so y(0) = halfCentre and y(radius) = halfEdge.
    const sag = 1 - Math.sqrt(Math.max(0, 1 - t * t));
    const y = halfCentre - sag * (halfCentre - halfEdge);
    points.push(new THREE.Vector2(x, y));
  }

  // Edge band — the ground flat every lens blank carries.
  points.push(new THREE.Vector2(radius, -halfEdge));

  // Rear surface: edge → apex, mirrored.
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const x = t * radius;
    const sag = 1 - Math.sqrt(Math.max(0, 1 - t * t));
    const y = -(halfCentre - sag * (halfCentre - halfEdge));
    points.push(new THREE.Vector2(x, y));
  }

  return points;
}
