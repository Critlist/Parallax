import type { GraphData, GraphNode } from "@/lib/graph3d";
import styles from "./GraphViewer.module.css";
import type { NodeInspectorProps } from "./types";

function endpointId(endpoint: unknown): string {
  if (typeof endpoint === "string") return endpoint;
  if (endpoint && typeof endpoint === "object" && "id" in endpoint) {
    return String(endpoint.id);
  }
  return String(endpoint);
}

function relationCounts(node: GraphNode, links: GraphData["links"]) {
  const counts = new Map<string, number>();
  let degree = 0;
  for (const link of links) {
    if (
      endpointId(link.source) !== node.id &&
      endpointId(link.target) !== node.id
    ) {
      continue;
    }
    degree += 1;
    const type = link.type ?? "related";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return { degree, counts: [...counts.entries()] };
}

export function NodeInspector({
  node,
  graphData,
  onFocus,
  onClear,
}: NodeInspectorProps) {
  const { degree, counts } = relationCounts(node, graphData?.links ?? []);

  return (
    <section className={styles.inspector} aria-label="Selected node">
      <div className={styles.panelHeader}>
        <strong className={styles.inspectorTitle}>{String(node.name)}</strong>
        <button className={styles.textButton} onClick={onClear}>
          Clear
        </button>
      </div>
      <div className={styles.detail}>id: {node.id}</div>
      <div className={styles.detail}>type: {String(node.type)}</div>
      {typeof node.group === "number" ? (
        <div className={styles.detail}>community: {node.group}</div>
      ) : null}
      <div className={styles.detail}>degree: {degree}</div>
      {node.filePath ? (
        <div className={styles.path}>{String(node.filePath)}</div>
      ) : null}
      {typeof node.sourceLocation === "string" ? (
        <div className={styles.path}>{node.sourceLocation}</div>
      ) : null}
      {counts.length > 0 && (
        <div className={styles.relations}>
          {counts.map(([type, count]) => (
            <div key={type}>
              {type}: {count}
            </div>
          ))}
        </div>
      )}
      <button className={styles.secondaryButton} onClick={onFocus}>
        Focus node
      </button>
    </section>
  );
}
