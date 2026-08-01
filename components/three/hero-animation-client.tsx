"use client";
import dynamic from "next/dynamic";

const HeroAnimation = dynamic(
  () => import("./hero-animation").then((m) => m.HeroAnimation),
  { ssr: false, loading: () => <div className="w-full h-full" /> }
);

export { HeroAnimation };
