import { useState, type ReactNode } from "react";
import styles from "./GraphViewer.module.css";
import type { FilterPanelProps } from "./types";

export function FilterPanel({
  typeCounts,
  disabledTypes,
  communityCounts,
  disabledCommunities,
  relationCounts,
  disabledRelations,
  confidenceCounts,
  disabledConfidences,
  onToggleType,
  onToggleCommunity,
  onToggleRelation,
  onToggleConfidence,
  onClearFilters,
}: FilterPanelProps) {
  const hasFilters =
    disabledTypes.size > 0 ||
    disabledCommunities.size > 0 ||
    disabledRelations.size > 0 ||
    disabledConfidences.size > 0;

  if (
    typeCounts.length === 0 &&
    communityCounts.length === 0 &&
    relationCounts.length === 0 &&
    confidenceCounts.length === 0
  ) {
    return null;
  }

  return (
    <section className={styles.panel} aria-label="Graph filters">
      <div className={styles.panelHeader}>
        <strong className={styles.title}>Filters</strong>
        {hasFilters && (
          <button className={styles.textButton} onClick={onClearFilters}>
            Clear
          </button>
        )}
      </div>
      {typeCounts.length > 0 && (
        <FilterGroup title="Types">
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
        </FilterGroup>
      )}
      {communityCounts.length > 0 && (
        <FilterGroup title="Communities">
          {communityCounts.map(([community, count]) => (
            <label key={community} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={!disabledCommunities.has(community)}
                onChange={() => onToggleCommunity(community)}
              />
              <span>community {community}</span>
              <span className={styles.count}>{count}</span>
            </label>
          ))}
        </FilterGroup>
      )}
      {relationCounts.length > 0 && (
        <FilterGroup title="Relations">
          {relationCounts.map(([relation, count]) => (
            <label key={relation} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={!disabledRelations.has(relation)}
                onChange={() => onToggleRelation(relation)}
              />
              <span>{relation}</span>
              <span className={styles.count}>{count}</span>
            </label>
          ))}
        </FilterGroup>
      )}
      {confidenceCounts.length > 0 && (
        <FilterGroup title="Confidence">
          {confidenceCounts.map(([confidence, count]) => (
            <label key={confidence} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={!disabledConfidences.has(confidence)}
                onChange={() => onToggleConfidence(confidence)}
              />
              <span>{confidence.toLowerCase()}</span>
              <span className={styles.count}>{count}</span>
            </label>
          ))}
        </FilterGroup>
      )}
    </section>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.filterGroup}>
      <button
        type="button"
        className={styles.filterGroupTitle}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {open && <div className={styles.checkList}>{children}</div>}
    </div>
  );
}
