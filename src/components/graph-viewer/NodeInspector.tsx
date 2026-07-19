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

interface NeighborSummary {
  id: string;
  label: string;
  type: string;
  relation: string;
  direction: "incoming" | "outgoing";
}

function summarizeConnections(node: GraphNode, graphData: GraphData | null) {
  const nodesById = new Map((graphData?.nodes ?? []).map((n) => [n.id, n]));
  const counts = new Map<string, number>();
  const neighbors: NeighborSummary[] = [];
  let degree = 0;
  let incoming = 0;
  let outgoing = 0;

  for (const link of graphData?.links ?? []) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    const isIncoming = target === node.id;
    const isOutgoing = source === node.id;
    if (!isIncoming && !isOutgoing) {
      continue;
    }

    degree += 1;
    if (isIncoming) incoming += 1;
    if (isOutgoing) outgoing += 1;

    const type = link.type ?? "related";
    counts.set(type, (counts.get(type) ?? 0) + 1);
    const neighborId = isIncoming ? source : target;
    const neighbor = nodesById.get(neighborId);
    neighbors.push({
      id: neighborId,
      label: neighbor?.name ?? neighborId,
      type: neighbor?.type ?? "unknown",
      relation: type,
      direction: isIncoming ? "incoming" : "outgoing",
    });
  }

  return {
    degree,
    incoming,
    outgoing,
    counts: [...counts.entries()],
    neighbors,
  };
}

export function NodeInspector({
  node,
  graphData,
  isShowingNeighbors,
  onFocus,
  onShowNeighbors,
  onClearNeighbors,
  onClear,
}: NodeInspectorProps) {
  const { degree, incoming, outgoing, counts, neighbors } =
    summarizeConnections(node, graphData);

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
      <div className={styles.detail}>incoming: {incoming}</div>
      <div className={styles.detail}>outgoing: {outgoing}</div>
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
      {neighbors.length > 0 && (
        <div className={styles.neighbors}>
          <div className={styles.sectionTitle}>Connected nodes</div>
          {neighbors.slice(0, 8).map((neighbor) => (
            <div
              key={`${neighbor.direction}-${neighbor.id}-${neighbor.relation}`}
            >
              {neighbor.direction === "incoming"
                ? `${neighbor.label} -> ${neighbor.relation}`
                : `${neighbor.relation} -> ${neighbor.label}`}
              <span className={styles.resultMeta}> ({neighbor.type})</span>
            </div>
          ))}
          {neighbors.length > 8 && (
            <div className={styles.resultMeta}>
              {neighbors.length - 8} more connected nodes
            </div>
          )}
        </div>
      )}
      <div className={styles.inspectorActions}>
        <button className={styles.secondaryButton} onClick={onFocus}>
          Focus node
        </button>
        {isShowingNeighbors ? (
          <button className={styles.secondaryButton} onClick={onClearNeighbors}>
            Clear neighbors
          </button>
        ) : (
          <button
            className={styles.secondaryButton}
            onClick={onShowNeighbors}
            disabled={degree === 0}
          >
            Show neighbors
          </button>
        )}
      </div>
    </section>
  );
}
