import styles from "./GraphViewer.module.css";
import type { VisibleStats } from "./types";
import type { GraphifyStats } from "@/lib/graphifyAdapter";

interface StatsSummaryProps {
  stats: GraphifyStats;
  visibleStats: VisibleStats | null;
}

export function StatsSummary({ stats, visibleStats }: StatsSummaryProps) {
  return (
    <div className={styles.stats}>
      <div>
        {stats.nodeCount} nodes - {stats.linkCount} edges
      </div>
      {visibleStats &&
        (visibleStats.nodeCount !== stats.nodeCount ||
          visibleStats.linkCount !== stats.linkCount) && (
          <div>
            visible: {visibleStats.nodeCount} nodes - {visibleStats.linkCount}{" "}
            edges
          </div>
        )}
      <div>
        {stats.communityCount} communities - {stats.hyperedgeCount} hyperedges
      </div>
      {Object.entries(stats.fileTypeBreakdown).map(([type, count]) => (
        <div key={type} className={styles.subtle}>
          {type}: {count}
        </div>
      ))}
    </div>
  );
}
