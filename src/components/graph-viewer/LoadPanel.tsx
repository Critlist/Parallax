import styles from "./GraphViewer.module.css";
import { StatsSummary } from "./StatsSummary";
import type { LoadPanelProps } from "./types";

export function LoadPanel({
  loading,
  error,
  stats,
  visibleStats,
  examples,
  selectedExampleId,
  onSelectedExampleChange,
  onLoadExample,
  onFilePicked,
}: LoadPanelProps) {
  const selectedExample = examples.find(
    (example) => example.id === selectedExampleId,
  );

  return (
    <section className={styles.panel} aria-label="Graph loader">
      <strong className={styles.title}>Parallax</strong>
      <div className={styles.muted}>
        Renders Graphify (or any node_link_data) exports in 3D.
      </div>
      <label className={styles.fieldLabel}>
        Example graph
        <select
          className={styles.select}
          value={selectedExampleId}
          onChange={(e) => onSelectedExampleChange(e.target.value)}
          disabled={loading}
        >
          {examples.map((example) => (
            <option key={example.id} value={example.id}>
              {example.label}
            </option>
          ))}
        </select>
      </label>
      {selectedExample && (
        <div className={styles.detail}>{selectedExample.description}</div>
      )}
      <button
        className={styles.button}
        onClick={onLoadExample}
        disabled={loading}
      >
        {loading ? "Loading..." : "Load example"}
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
