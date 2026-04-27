declare module 'hdbscanjs' {
  interface HdbscanDataPoint {
    data: number[];
    opt: number;
  }

  interface HdbscanNode {
    left: HdbscanNode | null;
    right: HdbscanNode | null;
    data: number[][];
    opt: number[];
    dist: number | null;
    edge: [number[], number[]] | null;
    parent: HdbscanNode | null;
    bbox: { minX: number; maxX: number; minY: number; maxY: number };
    isLeaf: boolean;
    filter(filterFunc: (node: HdbscanNode) => boolean, bbox?: { minX: number; maxX: number; minY: number; maxY: number } | null): HdbscanNode[];
  }

  type DistFunc = (p1: number[], p2: number[]) => number;

  class Hdbscan {
    constructor(dataset: HdbscanDataPoint[], distFunc?: DistFunc);
    getTree(): HdbscanNode;
    static distFunc: {
      euclidean: DistFunc;
      geoDist: DistFunc;
    };
  }

  export default Hdbscan;
}
