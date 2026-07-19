/**
 * 3D force-graph wrapper. Ported from omnigraph's Tauri app — this version has
 * no Tauri/IPC dependency, just DOM + 3d-force-graph + three.
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

const TYPE_COLORS: Record<string, string> = {
  // Graphify file_type buckets
  code: "#4A90E2",
  concept: "#FFB347",
  document: "#7ED321",
  rationale: "#BB8FCE",
  image: "#F7DC6F",
  // legacy omnigraph node types (kept for compatibility)
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
  private resizeHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initializeGraph();
    this.setupResizeListener();
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
      .linkDirectionalParticles((l: any) => (l.type === "calls" ? 1 : 0))
      .linkDirectionalParticleSpeed(0.005)
      .linkColor((l: any) =>
        l.confidence === "INFERRED" ? "#886644" : "#4A90E2",
      )
      .nodeLabel((n: any) =>
        typeof n.group === "number"
          ? `${n.name} (${n.type}, community ${n.group})`
          : `${n.name} (${n.type})`,
      )
      .nodeThreeObject((node: any) => {
        const size = this.getNodeSize(node);
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshLambertMaterial({
          color: this.getNodeColor(node),
          transparent: true,
          opacity: 0.9,
        });
        return new THREE.Mesh(geometry, material);
      })
      .onNodeClick(this.handleNodeClick.bind(this))
      .onNodeHover(this.handleNodeHover.bind(this));

    const scene = this.graph.scene();
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

  private handleNodeClick(node: any): void {
    const cameraPos = computeCameraPosition(node, 100);
    this.graph.cameraPosition(cameraPos, node, 1000);

    window.dispatchEvent(new CustomEvent("node-selected", { detail: node }));
  }

  private handleNodeHover(node: any): void {
    this.container.style.cursor = node ? "pointer" : "default";
  }

  public loadData(data: GraphData): void {
    this.graph.graphData(data);
  }

  public resetView(): void {
    this.graph.cameraPosition(
      { x: 0, y: 0, z: 300 },
      { x: 0, y: 0, z: 0 },
      1000,
    );
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
    }
  }
}
