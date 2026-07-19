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
  communityCounts: Array<[number, number]>;
  disabledCommunities: Set<number>;
  relationCounts: Array<[string, number]>;
  disabledRelations: Set<string>;
  confidenceCounts: Array<[string, number]>;
  disabledConfidences: Set<string>;
  onToggleType: (type: string) => void;
  onToggleCommunity: (community: number) => void;
  onToggleRelation: (relation: string) => void;
  onToggleConfidence: (confidence: string) => void;
  onClearFilters: () => void;
}

export interface GraphToolbarProps {
  hasGraph: boolean;
  hasSelected: boolean;
  searchTerm: string;
  searchResults: GraphNode[];
  debugVisible: boolean;
  onSearchTermChange: (term: string) => void;
  onSelectSearchResult: (node: GraphNode) => void;
  onResetView: () => void;
  onFitGraph: () => void;
  onFocusSelected: () => void;
  onToggleDebug: () => void;
}

export interface NodeInspectorProps {
  node: GraphNode;
  graphData: GraphData | null;
  isShowingNeighbors: boolean;
  onFocus: () => void;
  onShowNeighbors: () => void;
  onClearNeighbors: () => void;
  onClear: () => void;
}
