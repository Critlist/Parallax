import type { PerfSnapshot } from "@/lib/graph3d";
import styles from "./GraphViewer.module.css";

interface DebugOverlayProps {
  visible: boolean;
  snapshot: PerfSnapshot | null;
  fps: number;
  frameMs: number;
  loadMs: number | null;
}

function ms(value: number | null): string {
  return value === null ? "-" : `${Math.round(value)} ms`;
}

export function DebugOverlay({
  visible,
  snapshot,
  fps,
  frameMs,
  loadMs,
}: DebugOverlayProps) {
  if (!visible) return null;
  const rows: Array<[string, string]> = [
    ["FPS", `${fps}`],
    ["frame", `${frameMs.toFixed(1)} ms`],
    ["nodes", `${snapshot?.nodeCount ?? 0}`],
    ["visible edges", `${snapshot?.visibleEdgeCount ?? 0}`],
    ["particles", `${snapshot?.particleCount ?? 0}`],
    ["engine", snapshot?.engineRunning ? "running" : "stopped"],
    ["draw calls", `${snapshot?.drawCalls ?? 0}`],
    ["triangles", `${snapshot?.triangles ?? 0}`],
    ["geometries", `${snapshot?.geometries ?? 0}`],
    ["materials", `${snapshot?.materials ?? 0}`],
    ["textures", `${snapshot?.textures ?? 0}`],
    ["load", ms(loadMs)],
    ["settle", ms(snapshot?.settleMs ?? null)],
  ];
  return (
    <section className={styles.debugOverlay} aria-label="Performance overlay">
      <strong className={styles.debugTitle}>debug</strong>
      <dl className={styles.debugGrid}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.debugRow}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
