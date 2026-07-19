import styles from "./GraphViewer.module.css";
import type { GraphToolbarProps } from "./types";

export function GraphToolbar({
  hasGraph,
  hasSelected,
  searchTerm,
  searchResults,
  debugVisible,
  onSearchTermChange,
  onSelectSearchResult,
  onResetView,
  onFitGraph,
  onFocusSelected,
  onToggleDebug,
}: GraphToolbarProps) {
  if (!hasGraph) return null;

  return (
    <section className={styles.toolbar} aria-label="Graph controls">
      <label className={styles.searchLabel}>
        <span className={styles.srOnly}>Search graph</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder="Search nodes..."
          className={styles.searchInput}
        />
      </label>
      <div className={styles.toolbarActions}>
        <button className={styles.secondaryButton} onClick={onResetView}>
          Reset
        </button>
        <button className={styles.secondaryButton} onClick={onFitGraph}>
          Fit
        </button>
        <button
          className={styles.secondaryButton}
          onClick={onFocusSelected}
          disabled={!hasSelected}
        >
          Focus
        </button>
        <button
          className={styles.secondaryButton}
          onClick={onToggleDebug}
          aria-pressed={debugVisible}
        >
          Debug
        </button>
      </div>
      {searchTerm.trim() && (
        <div className={styles.searchResults} aria-label="Search results">
          {searchResults.length === 0 ? (
            <div className={styles.muted}>No matching nodes</div>
          ) : (
            searchResults.map((node) => (
              <button
                key={node.id}
                className={styles.resultButton}
                onClick={() => onSelectSearchResult(node)}
              >
                <span>{node.name || node.id}</span>
                <span className={styles.resultMeta}>
                  {node.type}
                  {typeof node.group === "number"
                    ? ` - community ${node.group}`
                    : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}
