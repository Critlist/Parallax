import type { GraphData } from "./graph3d";

/**
 * Shape of a Graphify `graph.json` export (networkx node_link_data format).
 * Only the fields we actually use are typed; Graphify's export carries more.
 */
export interface GraphifyExport {
  directed: boolean;
  multigraph: boolean;
  nodes: GraphifyNode[];
  links: GraphifyLink[];
  hyperedges?: GraphifyHyperedge[];
  built_at_commit?: string;
}

export interface GraphifyNode {
  id: string;
  label: string;
  file_type: string; // code | concept | document | rationale | image
  source_file?: string;
  source_location?: string;
  community?: number;
  norm_label?: string;
  _origin?: string;
}

export interface GraphifyLink {
  source: string;
  target: string;
  relation: string; // calls | contains | imports | references | ...
  confidence?: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  confidence_score?: number;
  weight?: number;
  source_file?: string;
  source_location?: string;
}

export interface GraphifyHyperedge {
  id: string;
  label: string;
  nodes: string[];
  relation: string;
  confidence?: string;
  confidence_score?: number;
  source_file?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Structural type guard. Verifies not just that `nodes`/`links` are arrays but
 * that each element carries the identity fields the adapter dereferences —
 * a node `id` and a link `source`/`target`. Without the per-element check a
 * malformed-but-array export slips through here and throws deep inside
 * `fromGraphifyExport`, where the caller can only report a misleading
 * "could not parse JSON" for a file that parsed fine. Graphify-specific
 * richness (label, file_type, …) is intentionally not required, so generic
 * node_link_data exports still pass.
 */
export function isGraphifyExport(raw: unknown): raw is GraphifyExport {
  if (!isObject(raw)) return false;
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.links)) return false;
  const nodesOk = raw.nodes.every(
    (n) => isObject(n) && typeof n.id === "string",
  );
  const linksOk = raw.links.every(
    (l) =>
      isObject(l) &&
      typeof l.source === "string" &&
      typeof l.target === "string",
  );
  return nodesOk && linksOk;
}

/**
 * Referential-integrity check, separate from the structural guard: every link
 * endpoint must point at a node that actually exists. Returns a human-readable
 * message naming the first offending id, or null when the graph is consistent.
 */
export function validateGraphReferences(raw: GraphifyExport): string | null {
  const ids = new Set(raw.nodes.map((n) => n.id));
  for (const link of raw.links) {
    if (!ids.has(link.source)) {
      return `Link references unknown node id "${link.source}".`;
    }
    if (!ids.has(link.target)) {
      return `Link references unknown node id "${link.target}".`;
    }
  }
  return null;
}

/**
 * Converts a Graphify `graph.json` export into the GraphData shape the 3D
 * viewer understands. Node "size" is set to raw degree so the existing
 * sqrt-scaled sizing logic in graph3d.ts self-adjusts.
 */
export function fromGraphifyExport(raw: GraphifyExport): GraphData {
  const degree = new Map<string, number>();
  for (const link of raw.links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }

  const nodes = raw.nodes.map((n) => ({
    id: n.id,
    name: n.label,
    type: n.file_type,
    filePath: n.source_file,
    group: n.community,
    size: degree.get(n.id) ?? 0,
    sourceLocation: n.source_location,
  }));

  const links = raw.links.map((l) => ({
    source: l.source,
    target: l.target,
    type: l.relation,
    confidence: l.confidence,
    value: l.confidence_score ?? l.weight ?? 1,
  }));

  return { nodes, links };
}

export interface GraphifyStats {
  nodeCount: number;
  linkCount: number;
  communityCount: number;
  hyperedgeCount: number;
  fileTypeBreakdown: Record<string, number>;
}

export function statsFor(raw: GraphifyExport): GraphifyStats {
  const communities = new Set<number>();
  const fileTypeBreakdown: Record<string, number> = {};

  for (const n of raw.nodes) {
    if (typeof n.community === "number") communities.add(n.community);
    fileTypeBreakdown[n.file_type] = (fileTypeBreakdown[n.file_type] ?? 0) + 1;
  }

  return {
    nodeCount: raw.nodes.length,
    linkCount: raw.links.length,
    communityCount: communities.size,
    hyperedgeCount: raw.hyperedges?.length ?? 0,
    fileTypeBreakdown,
  };
}
