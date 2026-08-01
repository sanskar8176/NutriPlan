"use client";
import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float, Stars } from "@react-three/drei";
import * as THREE from "three";

function NutritionOrb({
  position,
  color,
  speed,
  distort,
  scale,
}: {
  position: [number, number, number];
  color: string;
  speed: number;
  distort: number;
  scale: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    // Throttle: only update every 2nd frame
    if (Math.round(state.clock.elapsedTime * 30) % 2 !== 0) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
    meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.5;
  });

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={0.8}>
      <Sphere ref={meshRef} args={[scale, 32, 32]} position={position}>
        <MeshDistortMaterial
          color={color}
          distort={distort}
          speed={1}
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.85}
        />
      </Sphere>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#22c55e" />

      <Stars radius={80} depth={50} count={300} factor={3} fade speed={0.3} />

      {/* Main large orb — protein (green) */}
      <NutritionOrb position={[0, 0, 0]} color="#16a34a" speed={0.8} distort={0.4} scale={1.4} />

      {/* Carbs orb — amber */}
      <NutritionOrb position={[2.8, 1.2, -1]} color="#f59e0b" speed={1.2} distort={0.3} scale={0.85} />

      {/* Fat orb — coral */}
      <NutritionOrb position={[-2.5, -1, -0.5]} color="#f97316" speed={0.9} distort={0.5} scale={0.7} />

      {/* Small accent orbs */}
      <NutritionOrb position={[1.5, -2, 0.5]} color="#86efac" speed={1.5} distort={0.2} scale={0.45} />
      <NutritionOrb position={[-1.8, 1.8, -1]} color="#34d399" speed={1.1} distort={0.35} scale={0.55} />
    </>
  );
}

export function HeroAnimation() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      {/* Legend overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 text-xs font-medium">
        {[
          { color: "bg-green-600", label: "Protein" },
          { color: "bg-amber-500", label: "Carbs" },
          { color: "bg-orange-500", label: "Fat" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 rounded-full bg-[var(--background)]/70 backdrop-blur px-3 py-1.5 border border-[var(--border)]">
            <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            <span className="text-[var(--foreground)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
