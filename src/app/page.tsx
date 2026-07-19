"use client";

import dynamic from "next/dynamic";

// 3d-force-graph touches `window` at import time, so it can't be server-rendered.
const GraphViewer = dynamic(() => import("@/components/GraphViewer"), {
  ssr: false,
});

export default function Home() {
  return <GraphViewer />;
}
