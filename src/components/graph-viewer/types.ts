import type { GraphData, GraphNode } from "@/lib/graph3d";
import type { GraphifyStats } from "@/lib/graphifyAdapter";

export interface VisibleStats {
  nodeCount: number;
  linkCount: number;
}

export interface LoadPanelProps {
  loading: boolean;
  error: string | null;
  stats: GraphifyStats | null;
  visibleStats: VisibleStats | null;
  onLoadSample: () => void;
  onFilePicked: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface FilterPanelProps {
  typeCounts: Array<[string, number]>;
  disabledTypes: Set<string>;
  onToggleType: (type: string) => void;
  onClearFilters: () => void;
}

export interface GraphToolbarProps {
  hasGraph: boolean;
  hasSelected: boolean;
  searchTerm: string;
  searchResults: GraphNode[];
  onSearchTermChange: (term: string) => void;
  onSelectSearchResult: (node: GraphNode) => void;
  onResetView: () => void;
  onFocusSelected: () => void;
}

export interface NodeInspectorProps {
  node: GraphNode;
  graphData: GraphData | null;
  onFocus: () => void;
  onClear: () => void;
}
