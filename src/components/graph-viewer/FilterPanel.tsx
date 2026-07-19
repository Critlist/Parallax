import styles from "./GraphViewer.module.css";
import type { FilterPanelProps } from "./types";

export function FilterPanel({
  typeCounts,
  disabledTypes,
  onToggleType,
  onClearFilters,
}: FilterPanelProps) {
  if (typeCounts.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Graph filters">
      <div className={styles.panelHeader}>
        <strong className={styles.title}>Filters</strong>
        {disabledTypes.size > 0 && (
          <button className={styles.textButton} onClick={onClearFilters}>
            Clear
          </button>
        )}
      </div>
      <div className={styles.checkList}>
        {typeCounts.map(([type, count]) => (
          <label key={type} className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!disabledTypes.has(type)}
              onChange={() => onToggleType(type)}
            />
            <span>{type}</span>
            <span className={styles.count}>{count}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
