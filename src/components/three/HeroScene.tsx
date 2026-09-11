"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
  PerformanceMonitor,
} from "@react-three/drei";
import { lensProfile } from "./lensProfile";

/* ------------------------------------------------------------------ */
/* Backdrop — the optical blueprint the lens actually refracts.        */
/* ------------------------------------------------------------------ */

const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const backdropFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  // Screen-space-consistent grid line, so the rule weight stays even
  // whether it sits at the centre of the plane or out at the edge.
  float gridLine(vec2 uv, float density) {
    vec2 scaled = uv * density;
    vec2 g = abs(fract(scaled - 0.5) - 0.5) / fwidth(scaled);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }

  void main() {
    vec2 uv = vUv;
    vec2 centred = uv - vec2(0.62, 0.5);
    float d = length(centred * vec2(1.5, 1.0));

    vec3 deep = vec3(0.020, 0.045, 0.086);
    vec3 mid  = vec3(0.070, 0.140, 0.255);
    vec3 col  = mix(mid, deep, smoothstep(0.02, 0.68, d));

    float fine   = gridLine(uv * vec2(2.6, 1.35), 26.0);
    float coarse = gridLine(uv * vec2(2.6, 1.35), 6.5);
    float falloff = 1.0 - smoothstep(0.05, 0.58, d);
    col += fine * 0.045 * falloff;
    col += coarse * 0.085 * falloff;

    // Concentric rings — the interference pattern of a lens under test.
    float rings = sin(d * 46.0 - uTime * 0.5);
    col += smoothstep(0.94, 1.0, rings) * vec3(0.12, 0.22, 0.42) * falloff * 0.9;

    // A slow diagonal sweep, reading as light travelling across glass.
    float sweep = sin((uv.x * 3.2 + uv.y * 1.6) - uTime * 0.22);
    col += smoothstep(0.9, 1.0, sweep) * vec3(0.145, 0.251, 0.447) * 0.4;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Backdrop() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // Drive the clock on the material instance rather than on the memoised
  // object, so nothing captured by a hook is mutated after the fact.
  useFrame((_, delta) => {
    const current = material.current;
    if (current) current.uniforms.uTime.value += delta;
  });

  return (
    <mesh position={[0, 0, -9]} scale={[34, 20, 1]}>
      <planeGeometry />
      <shaderMaterial
        ref={material}
        vertexShader={backdropVertex}
        fragmentShader={backdropFragment}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Iris — the logo's eye as a mechanical aperture plate.               */
/* ------------------------------------------------------------------ */

const BLADE_COUNT = 8;

/** Disc with an octagonal bite out of the middle — a stopped-down iris. */
function useIrisGeometry(outerRadius: number, openingRadius: number) {
  return useMemo(() => {
    const disc = new THREE.Shape();
    disc.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

    const opening = new THREE.Path();
    for (let i = 0; i <= BLADE_COUNT; i++) {
      const angle = (i / BLADE_COUNT) * Math.PI * 2 + Math.PI / BLADE_COUNT;
      const x = Math.cos(angle) * openingRadius;
      const y = Math.sin(angle) * openingRadius;
      if (i === 0) opening.moveTo(x, y);
      else opening.lineTo(x, y);
    }
    disc.holes.push(opening);

    return new THREE.ShapeGeometry(disc, 48);
  }, [outerRadius, openingRadius]);
}

function Iris() {
  const plateRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const geometry = useIrisGeometry(2.5, 1.2);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (plateRef.current) plateRef.current.rotation.z = t * 0.05;
    if (ringRef.current) ringRef.current.rotation.z = -t * 0.09;
  });

  return (
    <group>
      {/* Glow behind the opening, so the aperture reads as light coming through */}
      <mesh position={[0, 0, -0.35]}>
        <circleGeometry args={[1.3, 48]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>

      <group ref={plateRef}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color="#132444"
            metalness={0.85}
            roughness={0.42}
            side={THREE.DoubleSide}
            transparent
            opacity={0.92}
          />
        </mesh>
        {/* Blade seams radiating from each vertex of the opening */}
        {Array.from({ length: BLADE_COUNT }, (_, i) => {
          const angle = (i / BLADE_COUNT) * Math.PI * 2 + Math.PI / BLADE_COUNT;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 1.85, Math.sin(angle) * 1.85, 0.01]}
              rotation={[0, 0, angle]}
            >
              <planeGeometry args={[1.3, 0.012]} />
              <meshBasicMaterial color="#4f6b98" transparent opacity={0.5} />
            </mesh>
          );
        })}
      </group>

      <group ref={ringRef}>
        <mesh>
          <torusGeometry args={[2.62, 0.012, 8, 128]} />
          <meshBasicMaterial color="#2563eb" toneMapped={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[2.9, 0.005, 6, 128]} />
          <meshBasicMaterial color="#4f6b98" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Lens blanks                                                         */
/* ------------------------------------------------------------------ */

function LensBlank({
  radius,
  position,
  /** Extra rotation on top of the face-on orientation, in radians. */
  tilt = [0, 0, 0],
  quality,
}: {
  radius: number;
  position: [number, number, number];
  tilt?: [number, number, number];
  quality: "high" | "low";
}) {
  const points = useMemo(
    () =>
      lensProfile({
        radius,
        centreThickness: radius * 0.34,
        edgeThickness: radius * 0.1,
      }),
    [radius],
  );

  return (
    <mesh
      position={position}
      // The lathe axis runs on Y; +90° on X faces it at the camera, and the
      // tilt off that is what lets you read the edge band as a real blank.
      rotation={[Math.PI / 2 + tilt[0], tilt[1], tilt[2]]}
    >
      <latheGeometry args={[points, 72]} />
      {quality === "high" ? (
        <MeshTransmissionMaterial
          samples={4}
          resolution={384}
          transmission={1}
          roughness={0.02}
          thickness={radius * 0.7}
          ior={1.52} /* crown glass */
          chromaticAberration={0.22}
          anisotropy={0.1}
          distortion={0.12}
          distortionScale={0.3}
          temporalDistortion={0.05}
          clearcoat={1}
          attenuationDistance={6}
          attenuationColor="#dceaff"
          color="#ffffff"
        />
      ) : (
        <meshPhysicalMaterial
          transmission={0.96}
          thickness={radius * 0.6}
          roughness={0.14}
          ior={1.52}
          clearcoat={1}
          envMapIntensity={0.9}
          color="#cddffb"
          transparent
          opacity={0.5}
        />
      )}
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Rig — responsive placement, pointer parallax, scroll drift          */
/* ------------------------------------------------------------------ */

/** Width in world units the composition was designed against. */
const DESIGN_WIDTH = 9.3;

function Rig({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  // Keep the optics clear of the headline at every viewport width: sit them
  // in the right-hand third and shrink with the canvas rather than crop.
  const scale =
    THREE.MathUtils.clamp(viewport.width / DESIGN_WIDTH, 0.55, 1.15) * 0.8;
  const offsetX = viewport.width * 0.28;

  useFrame((state, delta) => {
    if (!inner.current || !outer.current || reduced) return;
    const damp = 1 - Math.pow(0.001, delta);

    // Pointer parallax — small, so it reads as depth rather than as a toy.
    inner.current.rotation.y +=
      (state.pointer.x * 0.15 - inner.current.rotation.y) * damp;
    inner.current.rotation.x +=
      (-state.pointer.y * 0.1 - inner.current.rotation.x) * damp;

    // Drift the whole rig as the hero scrolls away.
    const scrolled =
      typeof window === "undefined"
        ? 0
        : Math.min(window.scrollY / (window.innerHeight || 1), 1);
    const targetY = scrolled * viewport.height * 0.3;
    outer.current.position.y += (targetY - outer.current.position.y) * damp;
  });

  return (
    <group ref={outer} position={[offsetX, 0, 0]} scale={scale}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

/* ------------------------------------------------------------------ */

export default function HeroScene({ reduced = false }: { reduced?: boolean }) {
  // Drop the expensive transmission material if the device cannot hold 60fps.
  const [quality, setQuality] = useState<"high" | "low">("high");

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 40 }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#050b15"]} />

      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setQuality("low")}
        onFallback={() => setQuality("low")}
      />

      <Backdrop />

      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 6]} intensity={1.1} />
      <directionalLight
        position={[-6, -2, 3]}
        intensity={0.55}
        color="#2563eb"
      />

      <Rig reduced={reduced}>
        <group position={[0, 0.25, -3.4]}>
          <Iris />
        </group>

        <Float
          speed={reduced ? 0 : 1.1}
          rotationIntensity={reduced ? 0 : 0.22}
          floatIntensity={reduced ? 0 : 0.55}
        >
          <LensBlank
            radius={1.18}
            position={[-0.2, 0.22, 0.9]}
            tilt={[-0.3, 0.26, 0]}
            quality={quality}
          />
        </Float>

        <Float
          speed={reduced ? 0 : 1.6}
          rotationIntensity={reduced ? 0 : 0.5}
          floatIntensity={reduced ? 0 : 1}
        >
          <LensBlank
            radius={0.38}
            position={[2.35, 1.95, -0.6]}
            tilt={[-0.5, 0.4, 0]}
            quality="low"
          />
        </Float>

        <Float
          speed={reduced ? 0 : 1.35}
          rotationIntensity={reduced ? 0 : 0.45}
          floatIntensity={reduced ? 0 : 0.85}
        >
          <LensBlank
            radius={0.27}
            position={[-2.15, -1.85, 0.2]}
            tilt={[0.45, -0.3, 0]}
            quality="low"
          />
        </Float>

        <Float
          speed={reduced ? 0 : 1.2}
          rotationIntensity={reduced ? 0 : 0.4}
          floatIntensity={reduced ? 0 : 0.7}
        >
          <LensBlank
            radius={0.2}
            position={[1.7, -2.3, 1.1]}
            tilt={[-0.6, 0.2, 0]}
            quality="low"
          />
        </Float>
      </Rig>

      {/* Self-contained studio lighting — no CDN HDRI fetch. */}
      <Environment resolution={128}>
        <Lightformer
          intensity={1.5}
          position={[0, 4, 3]}
          scale={[10, 3, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={1.5}
          position={[-5, 1, 2]}
          scale={[6, 6, 1]}
          color="#9ec1ff"
        />
        <Lightformer
          intensity={1.2}
          position={[5, -2, 1]}
          scale={[6, 6, 1]}
          color="#2563eb"
        />
        <Lightformer
          intensity={0.9}
          position={[0, -4, -2]}
          scale={[10, 3, 1]}
          color="#8fa0bc"
        />
      </Environment>
    </Canvas>
  );
}
