import styles from "./GraphViewer.module.css";
import { StatsSummary } from "./StatsSummary";
import type { LoadPanelProps } from "./types";

export function LoadPanel({
  loading,
  error,
  stats,
  visibleStats,
  onLoadSample,
  onFilePicked,
}: LoadPanelProps) {
  return (
    <section className={styles.panel} aria-label="Graph loader">
      <strong className={styles.title}>Parallax</strong>
      <div className={styles.muted}>
        Renders Graphify (or any node_link_data) exports in 3D.
      </div>
      <button
        className={styles.button}
        onClick={onLoadSample}
        disabled={loading}
      >
        {loading ? "Loading..." : "Load restoHack sample"}
      </button>
      <label className={styles.fileButton}>
        Load graph.json...
        <input
          type="file"
          accept=".json,application/json"
          onChange={onFilePicked}
          className={styles.fileInput}
        />
      </label>
      {error && <div className={styles.error}>{error}</div>}
      {stats && <StatsSummary stats={stats} visibleStats={visibleStats} />}
    </section>
  );
}
