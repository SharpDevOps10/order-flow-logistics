export interface GraphNode {
  id: number;
  lat: number;
  lng: number;
}

export interface Edge {
  to: number;
  weight: number;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function haversineKm(a: GraphNode, b: GraphNode): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

class MinHeap {
  private heap: Array<{ id: number; dist: number }> = [];

  push(item: { id: number; dist: number }): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: number; dist: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].dist <= this.heap[i].dist) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].dist < this.heap[smallest].dist)
        smallest = left;
      if (right < n && this.heap[right].dist < this.heap[smallest].dist)
        smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

export function buildCompleteGraph(nodes: GraphNode[]): Map<number, Edge[]> {
  const adj = new Map<number, Edge[]>();
  for (const a of nodes) {
    adj.set(a.id, []);
    for (const b of nodes) {
      if (a.id !== b.id) {
        adj.get(a.id)!.push({ to: b.id, weight: haversineKm(a, b) });
      }
    }
  }
  return adj;
}

export function dijkstra(
  nodes: GraphNode[],
  adj: Map<number, Edge[]>,
  sourceId: number,
): Map<number, number> {
  const dist = new Map<number, number>();
  for (const n of nodes) dist.set(n.id, Infinity);
  dist.set(sourceId, 0);

  const pq = new MinHeap();
  pq.push({ id: sourceId, dist: 0 });

  while (pq.size > 0) {
    const { id: u, dist: uDist } = pq.pop()!;
    if (uDist > dist.get(u)!) continue; // stale entry

    for (const edge of adj.get(u) ?? []) {
      const alt = dist.get(u)! + edge.weight;
      if (alt < dist.get(edge.to)!) {
        dist.set(edge.to, alt);
        pq.push({ id: edge.to, dist: alt });
      }
    }
  }

  return dist;
}

export interface OsmNode {
  id: number;
  lat: number;
  lng: number;
}

export interface OsmWay {
  id: number;
  nodes: number[];
  oneway: boolean;
}

export function buildOsmGraph(
  osmNodes: OsmNode[],
  osmWays: OsmWay[],
): { nodes: GraphNode[]; adj: Map<number, Edge[]> } {
  const nodeMap = new Map<number, OsmNode>();
  for (const n of osmNodes) nodeMap.set(n.id, n);

  const nodes: GraphNode[] = osmNodes.map((n) => ({
    id: n.id,
    lat: n.lat,
    lng: n.lng,
  }));

  const adj = new Map<number, Edge[]>();
  for (const n of nodes) adj.set(n.id, []);

  for (const way of osmWays) {
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const aId = way.nodes[i];
      const bId = way.nodes[i + 1];
      const a = nodeMap.get(aId);
      const b = nodeMap.get(bId);
      if (!a || !b) continue;

      const weight = haversineKm(a, b);
      adj.get(aId)?.push({ to: bId, weight });
      if (!way.oneway) {
        adj.get(bId)?.push({ to: aId, weight });
      }
    }
  }

  return { nodes, adj };
}

export function findNearestNode(
  nodes: GraphNode[],
  lat: number,
  lng: number,
): GraphNode {
  const target = { id: 0, lat, lng };
  let nearest = nodes[0];
  let minDist = haversineKm(nearest, target);
  for (const n of nodes) {
    const d = haversineKm(n, target);
    if (d < minDist) {
      minDist = d;
      nearest = n;
    }
  }
  return nearest;
}

export function dijkstraWithPath(
  nodes: GraphNode[],
  adj: Map<number, Edge[]>,
  sourceId: number,
): { distances: Map<number, number>; prev: Map<number, number | null> } {
  const distances = new Map<number, number>();
  const prev = new Map<number, number | null>();
  for (const n of nodes) {
    distances.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  distances.set(sourceId, 0);

  const pq = new MinHeap();
  pq.push({ id: sourceId, dist: 0 });

  while (pq.size > 0) {
    const { id: u, dist: uDist } = pq.pop()!;
    if (uDist > distances.get(u)!) continue;

    for (const edge of adj.get(u) ?? []) {
      const alt = distances.get(u)! + edge.weight;
      if (alt < distances.get(edge.to)!) {
        distances.set(edge.to, alt);
        prev.set(edge.to, u);
        pq.push({ id: edge.to, dist: alt });
      }
    }
  }

  return { distances, prev };
}

export function reconstructPath(
  prev: Map<number, number | null>,
  targetId: number,
): number[] {
  const path: number[] = [];
  let current: number | null = targetId;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }
  return path;
}

export function optimizeRoute(
  nodes: GraphNode[],
  adj: Map<number, Edge[]>,
  startId: number,
  deliveryIds: number[],
): number[] {
  const route: number[] = [startId];
  const unvisited = new Set(deliveryIds);

  let currentId = startId;

  while (unvisited.size > 0) {
    const distances = dijkstra(nodes, adj, currentId);

    let nearestId = -1;
    let nearestDist = Infinity;

    for (const id of unvisited) {
      const d = distances.get(id) ?? Infinity;
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = id;
      }
    }

    if (nearestId === -1) break;

    route.push(nearestId);
    unvisited.delete(nearestId);
    currentId = nearestId;
  }

  return route;
}
