import type { GraphNode } from "@/lib/graph3d";
import styles from "./GraphViewer.module.css";

interface NodeTooltipProps {
  node: GraphNode | null;
  position: { x: number; y: number } | null;
  degree: number;
}

export function NodeTooltip({ node, position, degree }: NodeTooltipProps) {
  if (!node || !position) return null;
  return (
    <section
      role="tooltip"
      className={styles.nodeTooltip}
      style={{ left: position.x + 12, top: position.y + 12 }}
    >
      <strong className={styles.tooltipTitle}>{node.name || node.id}</strong>
      <div className={styles.tooltipMeta}>
        {node.type}
        {typeof node.group === "number" ? ` - community ${node.group}` : ""}
      </div>
      <div className={styles.tooltipMeta}>degree: {degree}</div>
      {node.filePath && (
        <div className={styles.tooltipPath}>{node.filePath}</div>
      )}
    </section>
  );
}
