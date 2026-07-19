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

interface HoverEdgeBatch {
  segments: THREE.LineSegments;
  sources: Vec3[];
  targets: Vec3[];
}

interface NodeMaterialSet {
  normal: THREE.MeshLambertMaterial;
  dimmed: THREE.MeshLambertMaterial;
  lit: THREE.MeshLambertMaterial;
}

const NODE_GEOMETRY_RADIUS = 1;
const NODE_GEOMETRY_SEGMENTS = 8;
const NODE_GEOMETRY_RINGS = 8;
const MAX_DEVICE_PIXEL_RATIO = 1.25;
const LARGE_GRAPH_PARTICLE_BUDGET = 6000;
const LINK_PARTICLE_RESOLUTION = 2;
const RENDER_PARTICLE_COUNT = "__parallaxParticleCount";
const RENDER_LINK_VISIBLE = "__parallaxRenderVisible";
const STRESS_NODE_THRESHOLD = 20_000;
const STRESS_EDGE_THRESHOLD = 50_000;
const STRESS_LINK_BUDGET = 24_000;
const OWNED_DISPOSE = Symbol("parallaxOwnedDispose");

export type RenderMode = "standard" | "stress";

export interface GraphRenderPreset {
  mode: RenderMode;
  forceEngine: "d3" | "ngraph";
  particleBudget: number;
  linkBudget: number;
  linkOpacity: number;
  warmupTicks: number;
  cooldownTicks: number;
  cooldownTime: number;
  d3AlphaDecay: number;
}

const STANDARD_RENDER_PRESET: GraphRenderPreset = {
  mode: "standard",
  forceEngine: "d3",
  particleBudget: LARGE_GRAPH_PARTICLE_BUDGET,
  linkBudget: Number.POSITIVE_INFINITY,
  linkOpacity: 0.4,
  warmupTicks: 0,
  cooldownTicks: Number.POSITIVE_INFINITY,
  cooldownTime: 15_000,
  d3AlphaDecay: 0.0228,
};

const STRESS_RENDER_PRESET: GraphRenderPreset = {
  mode: "stress",
  forceEngine: "d3",
  particleBudget: 0,
  linkBudget: STRESS_LINK_BUDGET,
  linkOpacity: 0.14,
  warmupTicks: 40,
  cooldownTicks: 180,
  cooldownTime: 6000,
  d3AlphaDecay: 0.045,
};

type ProtectedDisposable<T extends { dispose: () => void }> = T & {
  [OWNED_DISPOSE]?: () => void;
};

function protectSharedDisposable<T extends { dispose: () => void }>(
  resource: T,
): ProtectedDisposable<T> {
  const protectedResource = resource as ProtectedDisposable<T>;
  if (!protectedResource[OWNED_DISPOSE]) {
    protectedResource[OWNED_DISPOSE] = protectedResource.dispose.bind(resource);
    protectedResource.dispose = () => {};
  }
  return protectedResource;
}

function disposeOwnedSharedResource(resource: { dispose: () => void }): void {
  const protectedResource = resource as ProtectedDisposable<typeof resource>;
  const dispose = protectedResource[OWNED_DISPOSE];
  if (dispose) {
    protectedResource[OWNED_DISPOSE] = undefined;
    dispose();
  } else {
    resource.dispose();
  }
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
  const renderCount = (link as Record<string, unknown>)[RENDER_PARTICLE_COUNT];
  if (typeof renderCount === "number") return renderCount;
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

function desiredParticleCount(link: { type?: string; confidence?: string }) {
  if (link.type === "calls") return 3;
  if (link.confidence === "EXTRACTED") return 2;
  return 1;
}

function particlePriority(link: { type?: string; confidence?: string }) {
  if (link.type === "calls") return 3;
  if (link.confidence === "EXTRACTED") return 2;
  if (
    link.type === "references" ||
    link.type === "imports" ||
    link.type === "imports_from"
  ) {
    return 1;
  }
  return 0;
}

export function assignParticleBudget(
  links: Array<{ type?: string; confidence?: string; [key: string]: unknown }>,
  budget = LARGE_GRAPH_PARTICLE_BUDGET,
): void {
  const desired = links.map((link) => desiredParticleCount(link));
  const desiredTotal = desired.reduce((total, count) => total + count, 0);
  if (desiredTotal <= budget) {
    links.forEach((link, index) => {
      link[RENDER_PARTICLE_COUNT] = desired[index];
    });
    return;
  }

  links.forEach((link) => {
    link[RENDER_PARTICLE_COUNT] = 0;
  });

  let remaining = budget;
  const ordered = links
    .map((link, index) => ({
      link,
      index,
      priority: particlePriority(link),
      desired: desired[index],
    }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index);

  for (let pass = 1; pass <= 3 && remaining > 0; pass += 1) {
    for (const item of ordered) {
      if (remaining <= 0) break;
      if (item.desired < pass) continue;
      item.link[RENDER_PARTICLE_COUNT] = pass;
      remaining -= 1;
    }
  }
}

export function graphRenderPreset(data: GraphData): GraphRenderPreset {
  if (
    data.nodes.length > STRESS_NODE_THRESHOLD ||
    data.links.length > STRESS_EDGE_THRESHOLD
  ) {
    return STRESS_RENDER_PRESET;
  }
  return STANDARD_RENDER_PRESET;
}

export function linkRenderVisible(link: GraphLink): boolean {
  const visible = (link as Record<string, unknown>)[RENDER_LINK_VISIBLE];
  return visible !== false;
}

function linkRenderPriority(
  link: GraphLink,
  nodesById: Map<string, GraphNode>,
): number {
  const source = nodesById.get(endpointId(link.source));
  const target = nodesById.get(endpointId(link.target));
  const bridgesCommunity =
    typeof source?.group === "number" &&
    typeof target?.group === "number" &&
    source.group !== target.group;
  const relation = link.type ?? "related";
  let score = bridgesCommunity ? 50 : 0;

  if (relation === "calls") score += 45;
  else if (relation === "imports" || relation === "imports_from") score += 38;
  else if (relation === "contains") score += 30;
  else if (relation === "references") score += 24;

  if (link.confidence === "EXTRACTED") score += 18;
  else if (link.confidence === "AMBIGUOUS") score += 6;

  if (typeof link.value === "number") score += Math.min(link.value, 5);
  return score;
}

export function assignLinkRenderBudget(
  data: GraphData,
  preset: GraphRenderPreset,
): void {
  if (data.links.length <= preset.linkBudget) {
    data.links.forEach((link) => {
      link[RENDER_LINK_VISIBLE] = true;
    });
    return;
  }

  data.links.forEach((link) => {
    link[RENDER_LINK_VISIBLE] = false;
  });

  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const visible = data.links
    .map((link, index) => ({
      index,
      link,
      priority: linkRenderPriority(link, nodesById),
    }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, preset.linkBudget);

  for (const item of visible) {
    item.link[RENDER_LINK_VISIBLE] = true;
  }
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

function createNodeMaterial(
  color: string,
  opacity: number,
  emissiveIntensity = 0,
): THREE.MeshLambertMaterial {
  return protectSharedDisposable(
    new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity,
      emissive:
        emissiveIntensity > 0
          ? new THREE.Color(color)
          : new THREE.Color(0x000000),
      emissiveIntensity,
    }),
  );
}

function disposeNodeMaterialSet(materials: NodeMaterialSet): void {
  disposeOwnedSharedResource(materials.normal);
  disposeOwnedSharedResource(materials.dimmed);
  disposeOwnedSharedResource(materials.lit);
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

function createHoverEdgeSegments(links: GraphLink[]): HoverEdgeBatch | null {
  const sources: Vec3[] = [];
  const targets: Vec3[] = [];
  const positions: number[] = [];
  for (const link of links) {
    const source = endpointPosition(link.source);
    const target = endpointPosition(link.target);
    if (!source || !target) continue;
    sources.push(source);
    targets.push(target);
    positions.push(source.x, source.y, source.z, target.x, target.y, target.z);
  }
  if (sources.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: HOVER_EDGE_COLOR,
    transparent: true,
    opacity: HOVER_EDGE_OPACITY,
    linewidth: HOVER_EDGE_WIDTH,
  });
  return {
    segments: new THREE.LineSegments(geometry, material),
    sources,
    targets,
  };
}

const EMPTY_NEIGHBORHOOD: HoverNeighborhood = {
  nodeIds: new Set(),
  linkKeys: new Set(),
  links: [],
};
const HOVER_EDGE_COLOR = "#ffffff";
const HOVER_EDGE_OPACITY = 0.58;
const HOVER_EDGE_WIDTH = 2;
const MAX_HOVER_OVERLAY_LINKS = 160;

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

export function selectHoverOverlayLinks(
  links: GraphLink[],
  maxLinks = MAX_HOVER_OVERLAY_LINKS,
): GraphLink[] {
  if (links.length <= maxLinks) return links;
  return links
    .map((link, index) => ({
      link,
      index,
      priority: particlePriority(link),
    }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, maxLinks)
    .map((item) => item.link);
}

export const BASE_NODE_OPACITY = 0.9;
const DIMMED_NODE_OPACITY = 0.15;
const LIT_EMISSIVE_INTENSITY = 0.6;

export interface NodeEmphasis {
  opacity: number;
  emissiveIntensity: number;
  variant: "normal" | "dimmed" | "lit";
}

export interface PerfSnapshot {
  nodeCount: number;
  visibleEdgeCount: number;
  particleCount: number;
  renderMode: RenderMode;
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
    return {
      opacity: BASE_NODE_OPACITY,
      emissiveIntensity: 0,
      variant: "normal",
    };
  }
  if (nodeId === hoveredId) {
    return {
      opacity: 1,
      emissiveIntensity: LIT_EMISSIVE_INTENSITY,
      variant: "lit",
    };
  }
  if (highlight.nodeIds.has(nodeId)) {
    return {
      opacity: BASE_NODE_OPACITY,
      emissiveIntensity: 0,
      variant: "normal",
    };
  }
  return {
    opacity: DIMMED_NODE_OPACITY,
    emissiveIntensity: 0,
    variant: "dimmed",
  };
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

export interface CameraFrame {
  position: Vec3;
  lookAt: Vec3;
}

const SECTION_CAMERA_MIN_DISTANCE = 140;
const SECTION_CAMERA_RADIUS_MULTIPLIER = 2.6;

function finitePosition(candidate: unknown): Vec3 | null {
  if (!candidate || typeof candidate !== "object") return null;
  const { x, y, z } = candidate as Partial<Vec3>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return null;
  }
  return { x, y, z };
}

export function computeSectionCameraFrame(
  nodes: GraphNode[],
  nodeIds: Set<string>,
  fallbackNode: GraphNode,
): CameraFrame {
  const lookAt = finitePosition(fallbackNode) ?? { x: 0, y: 0, z: 0 };
  const positions = nodes
    .filter((node) => nodeIds.has(node.id))
    .map(finitePosition)
    .filter((position): position is Vec3 => position !== null);

  if (positions.length === 0) {
    return {
      lookAt,
      position: { x: lookAt.x, y: lookAt.y, z: lookAt.z + 100 },
    };
  }
  const radius = positions.reduce(
    (maxRadius, position) =>
      Math.max(
        maxRadius,
        Math.hypot(
          position.x - lookAt.x,
          position.y - lookAt.y,
          position.z - lookAt.z,
        ),
      ),
    0,
  );
  const distance = Math.max(
    SECTION_CAMERA_MIN_DISTANCE,
    radius * SECTION_CAMERA_RADIUS_MULTIPLIER,
  );

  return {
    lookAt,
    position: { x: lookAt.x, y: lookAt.y, z: lookAt.z + distance },
  };
}

export class Graph3DVisualization {
  private graph: any;
  private container: HTMLElement;
  private onNodeSelected?: (node: GraphNode) => void;
  private onNodeHovered?: Graph3DVisualizationOptions["onNodeHovered"];
  private nodesById = new Map<string, GraphNode>();
  private nodeMeshes = new Map<string, THREE.Mesh>();
  private nodeMaterialKeys = new Map<string, string>();
  private nodeMaterialPool = new Map<string, NodeMaterialSet>();
  private nodeGeometry = protectSharedDisposable(
    new THREE.SphereGeometry(
      NODE_GEOMETRY_RADIUS,
      NODE_GEOMETRY_SEGMENTS,
      NODE_GEOMETRY_RINGS,
    ),
  );
  private hoverEdgeGroup = new THREE.Group();
  private hoverEdgeBatch: HoverEdgeBatch | null = null;
  private loadedData: GraphData | null = null;
  private hoverIndex = new Map<string, HoverNeighborhood>();
  private hoveredId: string | null = null;
  private hoverEnabled = true;
  private renderMode: RenderMode = "standard";
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
      .linkOpacity(STANDARD_RENDER_PRESET.linkOpacity)
      .linkWidth(0.6)
      .linkVisibility((l: any) => linkRenderVisible(l))
      .linkDirectionalParticles((l: any) => linkParticleCount(l))
      .linkDirectionalParticleResolution(LINK_PARTICLE_RESOLUTION)
      .linkDirectionalParticleSpeed((l: any) => linkParticleSpeed(l))
      .linkColor((l: any) =>
        l.confidence === "INFERRED" ? "#886644" : "#4A90E2",
      )
      .nodeLabel(() => "")
      .nodeThreeObject((node: any) => {
        const size = this.getNodeSize(node);
        const color = this.getNodeColor(node);
        const material = this.getNodeMaterialSet(color).normal;
        const mesh = new THREE.Mesh(this.nodeGeometry, material);
        mesh.scale.setScalar(size);
        this.nodeMeshes.set(node.id, mesh);
        this.nodeMaterialKeys.set(node.id, color);
        return mesh;
      })
      .onNodeClick(this.handleNodeClick.bind(this))
      .onNodeHover(this.handleNodeHover.bind(this))
      .onEngineTick(() => {
        this.engineRunning = true;
        this.updateHoverEdgePositions();
      })
      .onEngineStop(() => this.handleEngineStop());

    this.graph
      .renderer()
      ?.setPixelRatio?.(
        Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
      );

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

  private getNodeMaterialSet(color: string): NodeMaterialSet {
    const existing = this.nodeMaterialPool.get(color);
    if (existing) return existing;

    const materials: NodeMaterialSet = {
      normal: createNodeMaterial(color, BASE_NODE_OPACITY),
      dimmed: createNodeMaterial(color, DIMMED_NODE_OPACITY),
      lit: createNodeMaterial(color, 1, LIT_EMISSIVE_INTENSITY),
    };
    this.nodeMaterialPool.set(color, materials);
    return materials;
  }

  private materialForNodeVariant(
    nodeId: string,
    variant: NodeEmphasis["variant"],
  ): THREE.MeshLambertMaterial {
    const color = this.nodeMaterialKeys.get(nodeId);
    return this.getNodeMaterialSet(color ?? "#7ED321")[variant];
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
      mesh.material = this.materialForNodeVariant(id, emphasis.variant);
    }
    this.applyHoverEdgeHighlight(highlight);
  }

  private applyHoverEdgeHighlight(highlight: HoverNeighborhood): void {
    this.clearHoverEdges();
    if (!this.hoverEnabled || this.hoveredId === null) {
      return;
    }
    const batch = createHoverEdgeSegments(
      selectHoverOverlayLinks(highlight.links),
    );
    if (!batch) return;
    this.hoverEdgeBatch = batch;
    this.hoverEdgeGroup.add(batch.segments);
  }

  private updateHoverEdgePositions(): void {
    if (!this.hoverEdgeBatch) return;
    const positions =
      this.hoverEdgeBatch.segments.geometry.getAttribute("position");
    if (!positions) return;
    for (let i = 0; i < this.hoverEdgeBatch.sources.length; i += 1) {
      const source = this.hoverEdgeBatch.sources[i];
      const target = this.hoverEdgeBatch.targets[i];
      positions.setXYZ(i * 2, source.x, source.y, source.z);
      positions.setXYZ(i * 2 + 1, target.x, target.y, target.z);
    }
    positions.needsUpdate = true;
    this.hoverEdgeBatch.segments.geometry.computeBoundingSphere();
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
    this.hoverEdgeBatch = null;
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

  private applyRenderPreset(preset: GraphRenderPreset): void {
    this.renderMode = preset.mode;
    this.graph
      .forceEngine(preset.forceEngine)
      .linkOpacity(preset.linkOpacity)
      .warmupTicks(preset.warmupTicks)
      .cooldownTicks(preset.cooldownTicks)
      .cooldownTime(preset.cooldownTime)
      .d3AlphaDecay(preset.d3AlphaDecay);
  }

  public loadData(data: GraphData): void {
    const preset = graphRenderPreset(data);
    this.nodesById = new Map(data.nodes.map((node) => [node.id, node]));
    this.loadedData = data;
    this.hoverIndex = buildHoverHighlightIndex(data);
    assignParticleBudget(data.links, preset.particleBudget);
    assignLinkRenderBudget(data, preset);
    this.applyRenderPreset(preset);
    // Drop meshes from any previous graph; graphData() rebuilds them via
    // nodeThreeObject for the new node set.
    this.nodeMeshes.clear();
    this.nodeMaterialKeys.clear();
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
    const visibleLinks = data.links.filter(linkRenderVisible);
    return {
      nodeCount: data.nodes.length,
      visibleEdgeCount: visibleLinks.length,
      particleCount: sumParticleCount(data.links),
      renderMode: this.renderMode,
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
      this.nodeMaterialKeys.clear();
      for (const materials of this.nodeMaterialPool.values()) {
        disposeNodeMaterialSet(materials);
      }
      this.nodeMaterialPool.clear();
      disposeOwnedSharedResource(this.nodeGeometry);
      this.clearHoverEdges();
      this.loadedData = null;
      this.hoverIndex.clear();
      this.hoveredId = null;
      this.hoverEnabled = true;
      this.renderMode = "standard";
      this.engineRunning = false;
      this.settleStartMs = null;
      this.settleMs = null;
    }
  }

  private moveCameraToNode(node: any): void {
    const highlight = this.hoverIndex.get(node.id);
    const frame = computeSectionCameraFrame(
      this.loadedData?.nodes ?? [node],
      highlight?.nodeIds ?? new Set([node.id]),
      node,
    );
    this.graph.cameraPosition(frame.position, frame.lookAt, 1000);
  }
}
