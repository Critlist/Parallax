/**
 * 3D force-graph wrapper extracted from the older Omnigraph renderer. This
 * version has no app-shell dependency, just DOM + 3d-force-graph + three.
 *
 * `3d-force-graph` ships no usable types and augments node/link objects at
 * runtime (x/y/z, __degree, etc.), so `any` is used deliberately at the
 * boundary with it rather than faked out with speculative interfaces.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  filePath?: string;
  size?: number; // raw weight (e.g. degree) — auto-scaled by getNodeSize
  group?: number; // community id
  [key: string]: unknown;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: string;
  value?: number; // e.g. confidence score; carried through but not yet wired to any visual channel
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Graph3DVisualizationOptions {
  onNodeSelected?: (node: GraphNode) => void;
  onNodeHovered?: (
    node: GraphNode | null,
    position: { x: number; y: number } | null,
  ) => void;
}

interface HoverEdge {
  line: THREE.Line;
  source: Vec3;
  target: Vec3;
}

const TYPE_COLORS: Record<string, string> = {
  // Graphify file_type buckets
  code: "#4A90E2",
  concept: "#FFB347",
  document: "#7ED321",
  rationale: "#BB8FCE",
  image: "#F7DC6F",
  // Legacy Omnigraph node types kept for compatibility with older exports.
  file: "#4A90E2",
  module: "#7B68EE",
  class: "#50C878",
  function: "#FFB347",
  method: "#FFA07A",
  variable: "#87CEEB",
  import: "#DDA0DD",
  export: "#F0E68C",
  interface: "#98D8C8",
  property: "#F7DC6F",
  type_alias: "#BB8FCE",
  enum: "#85C1E2",
};

const TYPE_BASE_SIZE: Record<string, number> = {
  code: 4,
  concept: 6,
  document: 5,
  rationale: 5,
  image: 4,
};

// Golden-angle hue rotation gives well-separated, stable colors for an
// arbitrary number of categories without needing to know the count upfront.
function communityColor(group: number): string {
  const hue = (group * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 65%, 58%)`;
}

/**
 * Particle count communicates relationship strength: call edges (direction
 * matters most) flow strongest, high-confidence (EXTRACTED) edges flow
 * visibly, everything else keeps a subtle flow — never zero, so the graph
 * always reads as a living system.
 */
export function linkParticleCount(link: {
  type?: string;
  confidence?: string;
}): number {
  if (link.type === "calls") return 3;
  if (link.confidence === "EXTRACTED") return 2;
  return 1;
}

export function linkParticleSpeed(link: { type?: string }): number {
  return link.type === "calls" ? 0.01 : 0.005;
}

export function sumParticleCount(
  links: Array<{ type?: string; confidence?: string }>,
): number {
  return links.reduce((total, link) => total + linkParticleCount(link), 0);
}

// renderer.info tracks geometries and textures but NOT materials, so derive
// the active material count by traversing the scene for unique instances.
export function countSceneMaterials(scene: {
  traverse(cb: (obj: any) => void): void;
}): number {
  const materials = new Set<unknown>();
  scene.traverse((obj: any) => {
    const material = obj?.material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((m) => materials.add(m));
    else materials.add(material);
  });
  return materials.size;
}

export interface FpsMeter {
  fps: number;
  frameMs: number;
  sample(now: number): void;
}

/**
 * Moving-average FPS/frame-time meter. Call `sample(performance.now())` once
 * per animation frame. Pure and deterministic so it can be unit-tested with
 * fed timestamps instead of a real requestAnimationFrame loop.
 */
export function createFpsMeter(windowSize = 30): FpsMeter {
  const deltas: number[] = [];
  let last: number | null = null;
  const meter: FpsMeter = {
    fps: 0,
    frameMs: 0,
    sample(now: number) {
      if (last !== null) {
        deltas.push(now - last);
        if (deltas.length > windowSize) deltas.shift();
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        meter.frameMs = avg;
        meter.fps = avg > 0 ? Math.round(1000 / avg) : 0;
      }
      last = now;
    },
  };
  return meter;
}

export interface HoverHighlight {
  nodeIds: Set<string>;
  linkKeys: Set<string>;
}

export interface HoverNeighborhood extends HoverHighlight {
  links: GraphLink[];
}

// A link endpoint is an id string before the force sim runs and a node object
// (with `id`) afterward; normalize both to the id string.
export function endpointId(endpoint: unknown): string {
  if (typeof endpoint === "string") return endpoint;
  if (endpoint && typeof endpoint === "object" && "id" in endpoint) {
    return String((endpoint as { id: unknown }).id);
  }
  return String(endpoint);
}

export function linkKey(source: unknown, target: unknown): string {
  return `${endpointId(source)}->${endpointId(target)}`;
}

function endpointPosition(endpoint: unknown): Vec3 | null {
  if (!endpoint || typeof endpoint !== "object") return null;
  const candidate = endpoint as Partial<Vec3>;
  if (
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    typeof candidate.z !== "number" ||
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y) ||
    !Number.isFinite(candidate.z)
  ) {
    return null;
  }
  return candidate as Vec3;
}

function createHoverEdgeLine(source: Vec3, target: Vec3): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(source.x, source.y, source.z),
    new THREE.Vector3(target.x, target.y, target.z),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: HOVER_EDGE_COLOR,
    transparent: true,
    opacity: HOVER_EDGE_OPACITY,
    linewidth: HOVER_EDGE_WIDTH,
  });
  return new THREE.Line(geometry, material);
}

const EMPTY_NEIGHBORHOOD: HoverNeighborhood = {
  nodeIds: new Set(),
  linkKeys: new Set(),
  links: [],
};
const HOVER_EDGE_COLOR = "#ffffff";
const HOVER_EDGE_OPACITY = 0.86;
const HOVER_EDGE_WIDTH = 2;

/**
 * The hover affordance answers "what is this node connected to?" — the hovered
 * node plus its direct neighbors and the links between them. Empty when nothing
 * (or an unknown node) is hovered, which the renderer reads as "restore all".
 */
export function computeHoverHighlight(
  data: GraphData,
  hoveredId: string | null,
): HoverHighlight {
  const nodeIds = new Set<string>();
  const linkKeys = new Set<string>();
  if (hoveredId === null || !data.nodes.some((n) => n.id === hoveredId)) {
    return { nodeIds, linkKeys };
  }
  nodeIds.add(hoveredId);
  for (const link of data.links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (source === hoveredId || target === hoveredId) {
      nodeIds.add(source);
      nodeIds.add(target);
      linkKeys.add(linkKey(link.source, link.target));
    }
  }
  return { nodeIds, linkKeys };
}

export function buildHoverHighlightIndex(
  data: GraphData,
): Map<string, HoverNeighborhood> {
  const index = new Map<string, HoverNeighborhood>();
  for (const node of data.nodes) {
    index.set(node.id, {
      nodeIds: new Set([node.id]),
      linkKeys: new Set(),
      links: [],
    });
  }
  for (const link of data.links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    const key = linkKey(link.source, link.target);
    const sourceNeighborhood = index.get(source);
    if (sourceNeighborhood) {
      sourceNeighborhood.nodeIds.add(target);
      sourceNeighborhood.linkKeys.add(key);
      sourceNeighborhood.links.push(link);
    }
    const targetNeighborhood = index.get(target);
    if (targetNeighborhood) {
      targetNeighborhood.nodeIds.add(source);
      targetNeighborhood.linkKeys.add(key);
      targetNeighborhood.links.push(link);
    }
  }
  return index;
}

export const BASE_NODE_OPACITY = 0.9;
const DIMMED_NODE_OPACITY = 0.15;
const LIT_EMISSIVE_INTENSITY = 0.6;

export interface NodeEmphasis {
  opacity: number;
  emissiveIntensity: number;
}

export interface PerfSnapshot {
  nodeCount: number;
  visibleEdgeCount: number;
  particleCount: number;
  engineRunning: boolean;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  materials: number;
  settleMs: number | null;
}

/**
 * Emphasis states, driven entirely by the hover affordance:
 *   lit    — the hovered node (full opacity + glow)
 *   normal — a neighbor, or no active hover
 *   dimmed — everything else while a node is hovered
 */
export function nodeEmphasis(
  nodeId: string,
  hoveredId: string | null,
  highlight: HoverHighlight,
): NodeEmphasis {
  if (hoveredId === null || highlight.nodeIds.size === 0) {
    return { opacity: BASE_NODE_OPACITY, emissiveIntensity: 0 };
  }
  if (nodeId === hoveredId) {
    return { opacity: 1, emissiveIntensity: LIT_EMISSIVE_INTENSITY };
  }
  if (highlight.nodeIds.has(nodeId)) {
    return { opacity: BASE_NODE_OPACITY, emissiveIntensity: 0 };
  }
  return { opacity: DIMMED_NODE_OPACITY, emissiveIntensity: 0 };
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Camera target for a "fly to node" transition: pull the camera back along the
 * node's direction vector from the origin. A node sitting exactly at the origin
 * (single-node graph, or one the force sim hasn't positioned yet) has no
 * direction to scale toward — dividing by its zero/non-finite distance there
 * would yield NaN camera coordinates, so fall back to a fixed +z offset.
 */
export function computeCameraPosition(node: Vec3, distance: number): Vec3 {
  const originDistance = Math.hypot(node.x, node.y, node.z);
  if (!Number.isFinite(originDistance) || originDistance === 0) {
    return { x: 0, y: 0, z: distance };
  }
  const distRatio = 1 + distance / originDistance;
  return {
    x: node.x * distRatio,
    y: node.y * distRatio,
    z: node.z * distRatio,
  };
}

export class Graph3DVisualization {
  private graph: any;
  private container: HTMLElement;
  private onNodeSelected?: (node: GraphNode) => void;
  private onNodeHovered?: Graph3DVisualizationOptions["onNodeHovered"];
  private nodesById = new Map<string, GraphNode>();
  private nodeMeshes = new Map<string, THREE.Mesh>();
  private hoverEdgeGroup = new THREE.Group();
  private hoverEdges: HoverEdge[] = [];
  private loadedData: GraphData | null = null;
  private hoverIndex = new Map<string, HoverNeighborhood>();
  private hoveredId: string | null = null;
  private hoverEnabled = true;
  private engineRunning = false;
  private settleStartMs: number | null = null;
  private settleMs: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pointerPosition: { x: number; y: number } | null = null;
  private pointerMoveHandler: ((event: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    options: Graph3DVisualizationOptions = {},
  ) {
    this.container = container;
    this.onNodeSelected = options.onNodeSelected;
    this.onNodeHovered = options.onNodeHovered;
    this.initializeGraph();
    this.setupResizeListener();
    this.setupPointerListener();
  }

  private setupResizeListener(): void {
    let resizeTimeout: ReturnType<typeof setTimeout>;

    this.resizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.handleResize(), 250);
    };

    window.addEventListener("resize", this.resizeHandler);

    this.resizeObserver = new ResizeObserver(() => this.resizeHandler!());
    this.resizeObserver.observe(this.container);
  }

  private setupPointerListener(): void {
    this.pointerMoveHandler = (event: MouseEvent) => {
      this.pointerPosition = { x: event.clientX, y: event.clientY };
    };
    this.container.addEventListener("mousemove", this.pointerMoveHandler);
  }

  private handleResize(): void {
    if (!this.graph) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.graph.width(width).height(height);
    this.graph.refresh();
  }

  private initializeGraph(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.graph = (ForceGraph3D as any)()(this.container)
      .width(width)
      .height(height)
      .backgroundColor("#0a0a0a")
      .showNavInfo(false)
      .linkOpacity(0.4)
      .linkWidth(0.6)
      .linkDirectionalParticles((l: any) => linkParticleCount(l))
      .linkDirectionalParticleSpeed((l: any) => linkParticleSpeed(l))
      .linkColor((l: any) =>
        l.confidence === "INFERRED" ? "#886644" : "#4A90E2",
      )
      .nodeLabel(() => "")
      .nodeThreeObject((node: any) => {
        const size = this.getNodeSize(node);
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshLambertMaterial({
          color: this.getNodeColor(node),
          transparent: true,
          opacity: BASE_NODE_OPACITY,
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 0,
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.nodeMeshes.set(node.id, mesh);
        return mesh;
      })
      .onNodeClick(this.handleNodeClick.bind(this))
      .onNodeHover(this.handleNodeHover.bind(this))
      .onEngineTick(() => {
        this.engineRunning = true;
        this.updateHoverEdgePositions();
      })
      .onEngineStop(() => this.handleEngineStop());

    const scene = this.graph.scene();
    scene.add(this.hoverEdgeGroup);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    // A DirectionalLight emits along its position→target vector; left at the
    // default (0,0,0) it points nowhere and contributes no shading. Offset it
    // so it actually lights the graph from one side.
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(1, 1, 1);
    scene.add(directional);

    const gridHelper = new THREE.GridHelper(1000, 20, 0x444444, 0x222222);
    scene.add(gridHelper);
  }

  private getNodeSize(node: any): number {
    const baseSize = TYPE_BASE_SIZE[node.type] ?? 3;

    let weight = 1;
    if (node.size && node.size > 0) {
      weight = Math.sqrt(node.size / 4);
    }
    if (node.__degree) {
      weight = Math.max(weight, 1 + Math.log(node.__degree + 1) * 0.3);
    }

    return Math.min(Math.max(baseSize * weight, 2), 22);
  }

  private getNodeColor(node: any): string {
    if (typeof node.group === "number") {
      return communityColor(node.group);
    }
    return TYPE_COLORS[node.type] || "#7ED321";
  }

  private currentHoverHighlight(): HoverNeighborhood {
    return this.hoveredId !== null
      ? (this.hoverIndex.get(this.hoveredId) ?? EMPTY_NEIGHBORHOOD)
      : EMPTY_NEIGHBORHOOD;
  }

  /**
   * The hover affordance restyles the node meshes we own, in place. It must
   * NOT call `graph.refresh()` or re-register link/node accessors: those set
   * `_flushObjects` / trigger digests that rebuild every node mesh and every
   * link + directional-particle system, which discards these in-place material
   * mutations (visible flash) and locks on large graphs. `3d-force-graph` runs
   * a continuous render loop, so mutating an existing material shows next frame
   * on its own. Links keep their static styling; incident edge emphasis is
   * drawn by our own overlay group of line objects, which can be mutated
   * directly.
   */
  private applyHoverHighlight(): void {
    const highlight = this.currentHoverHighlight();
    for (const [id, mesh] of this.nodeMeshes) {
      const emphasis = nodeEmphasis(id, this.hoveredId, highlight);
      const material = mesh.material as THREE.MeshLambertMaterial;
      material.opacity = emphasis.opacity;
      material.emissiveIntensity = emphasis.emissiveIntensity;
      material.emissive =
        emphasis.emissiveIntensity > 0
          ? material.color.clone()
          : new THREE.Color(0x000000);
    }
    this.applyHoverEdgeHighlight(highlight);
  }

  private applyHoverEdgeHighlight(highlight: HoverNeighborhood): void {
    this.clearHoverEdges();
    if (!this.hoverEnabled || this.hoveredId === null) {
      return;
    }
    for (const link of highlight.links) {
      const source = endpointPosition(link.source);
      const target = endpointPosition(link.target);
      if (!source || !target) continue;
      const line = createHoverEdgeLine(source, target);
      this.hoverEdges.push({ line, source, target });
      this.hoverEdgeGroup.add(line);
    }
  }

  private updateHoverEdgePositions(): void {
    for (const edge of this.hoverEdges) {
      const positions = edge.line.geometry.getAttribute("position");
      if (!positions) continue;
      positions.setXYZ(0, edge.source.x, edge.source.y, edge.source.z);
      positions.setXYZ(1, edge.target.x, edge.target.y, edge.target.z);
      positions.needsUpdate = true;
      edge.line.geometry.computeBoundingSphere();
    }
  }

  private clearHoverEdges(): void {
    for (const edge of [...this.hoverEdgeGroup.children]) {
      this.hoverEdgeGroup.remove(edge);
      const geometry = (edge as { geometry?: { dispose?: () => void } })
        .geometry;
      geometry?.dispose?.();
      const material = (
        edge as {
          material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
        }
      ).material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose?.());
      } else {
        material?.dispose?.();
      }
    }
    this.hoverEdges = [];
  }

  private handleNodeClick(node: any): void {
    this.moveCameraToNode(node);
    this.onNodeSelected?.(node);
  }

  private handleNodeHover(node: any): void {
    if (!this.hoverEnabled) {
      this.container.style.cursor = "default";
      this.hoveredId = null;
      this.applyHoverHighlight();
      this.onNodeHovered?.(null, this.pointerPosition);
      return;
    }
    this.container.style.cursor = node ? "pointer" : "default";
    this.hoveredId = node ? node.id : null;
    this.applyHoverHighlight();
    this.onNodeHovered?.(node ?? null, this.pointerPosition);
  }

  private handleEngineStop(): void {
    this.engineRunning = false;
    if (this.settleStartMs !== null) {
      this.settleMs = performance.now() - this.settleStartMs;
    }
  }

  public loadData(data: GraphData): void {
    this.nodesById = new Map(data.nodes.map((node) => [node.id, node]));
    this.loadedData = data;
    this.hoverIndex = buildHoverHighlightIndex(data);
    // Drop meshes from any previous graph; graphData() rebuilds them via
    // nodeThreeObject for the new node set.
    this.nodeMeshes.clear();
    this.hoveredId = null;
    this.container.style.cursor = "default";
    this.clearHoverEdges();
    this.settleStartMs = performance.now();
    this.settleMs = null;
    this.engineRunning = true;
    this.graph.graphData(data);
  }

  public focusNode(nodeId: string): void {
    const node = this.nodesById.get(nodeId);
    if (!node) return;
    this.moveCameraToNode(node);
  }

  public resetView(): void {
    this.graph.cameraPosition(
      { x: 0, y: 0, z: 300 },
      { x: 0, y: 0, z: 0 },
      1000,
    );
  }

  public fitGraph(): void {
    this.graph.zoomToFit(1000, 80);
  }

  public setHoverEnabled(enabled: boolean): void {
    this.hoverEnabled = enabled;
    if (!enabled) {
      this.container.style.cursor = "default";
      this.hoveredId = null;
      this.applyHoverHighlight();
    }
  }

  public getPerfSnapshot(): PerfSnapshot | null {
    if (!this.graph) return null;
    const info = this.graph.renderer?.()?.info;
    const data = this.graph.graphData?.() ?? { nodes: [], links: [] };
    const scene = this.graph.scene?.();
    return {
      nodeCount: data.nodes.length,
      visibleEdgeCount: data.links.length,
      particleCount: sumParticleCount(data.links),
      engineRunning: this.engineRunning,
      drawCalls: info?.render?.calls ?? 0,
      triangles: info?.render?.triangles ?? 0,
      geometries: info?.memory?.geometries ?? 0,
      textures: info?.memory?.textures ?? 0,
      materials: scene ? countSceneMaterials(scene) : 0,
      settleMs: this.settleMs,
    };
  }

  public dispose(): void {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.pointerMoveHandler) {
      this.container.removeEventListener("mousemove", this.pointerMoveHandler);
      this.pointerMoveHandler = null;
      this.pointerPosition = null;
    }
    if (this.graph) {
      const renderer = this.graph.renderer?.();
      this.graph._destructor();
      // _destructor() disposes the renderer's internal caches but doesn't
      // force the underlying WebGL context to be released or detach the
      // canvas. Without this, React StrictMode double-mounts and dev
      // hot-reloads each orphan a live GL context — browsers cap
      // concurrent contexts (~16), so enough remounts silently breaks
      // rendering with no error.
      if (renderer) {
        renderer.forceContextLoss();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
      }
      this.graph = null;
      this.nodesById.clear();
      this.nodeMeshes.clear();
      this.clearHoverEdges();
      this.loadedData = null;
      this.hoverIndex.clear();
      this.hoveredId = null;
      this.hoverEnabled = true;
      this.engineRunning = false;
      this.settleStartMs = null;
      this.settleMs = null;
    }
  }

  private moveCameraToNode(node: any): void {
    const cameraPos = computeCameraPosition(node, 100);
    this.graph.cameraPosition(cameraPos, node, 1000);
  }
}
