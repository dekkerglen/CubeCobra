import React, { useEffect, useState } from 'react';

import Plot from 'react-plotly.js';

// Color palette for up to 100+ clusters
const PALETTE = [
  '#e6194b',
  '#3cb44b',
  '#ffe119',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#42d4f4',
  '#f032e6',
  '#bfef45',
  '#fabed4',
  '#469990',
  '#dcbeff',
  '#9A6324',
  '#fffac8',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000075',
  '#a9a9a9',
  '#e6beff',
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
  '#393b79',
  '#637939',
  '#8c6d31',
  '#843c39',
  '#7b4173',
  '#5254a3',
  '#6b6ecf',
  '#9c9ede',
  '#8ca252',
  '#b5cf6b',
  '#cedb9c',
  '#bd9e39',
  '#e7ba52',
  '#e7cb94',
  '#ad494a',
  '#d6616b',
  '#e7969c',
  '#a55194',
  '#ce6dbd',
  '#de9ed6',
  '#3182bd',
  '#6baed6',
  '#9ecae1',
  '#e6550d',
  '#fd8d3c',
  '#fdae6b',
  '#31a354',
  '#74c476',
  '#a1d99b',
  '#756bb1',
  '#9e9ac8',
  '#bcbddc',
  '#636363',
  '#969696',
  '#bdbdbd',
  '#f0027f',
  '#386cb0',
  '#beaed4',
  '#fdc086',
  '#ffff99',
  '#bf5b17',
  '#666666',
  '#a6cee3',
  '#b2df8a',
  '#fb9a99',
  '#fdbf6f',
  '#cab2d6',
  '#1b9e77',
  '#d95f02',
  '#7570b3',
  '#e7298a',
  '#66a61e',
  '#e6ab02',
  '#a6761d',
  '#b3e2cd',
  '#fdcdac',
  '#cbd5e8',
  '#f4cae4',
  '#e6f5c9',
  '#fff2ae',
  '#f1e2cc',
  '#cccccc',
  '#8dd3c7',
  '#bebada',
  '#fb8072',
  '#80b1d3',
  '#fdb462',
  '#b3de69',
  '#fccde5',
];

interface ScatterPlotProps {
  annotations: Record<string, string>;
}

interface PointData {
  count: number;
  numClusters: number;
  x: Float32Array;
  y: Float32Array;
  clusters: Uint16Array;
}

async function loadPoints(): Promise<PointData> {
  const res = await fetch('/data/app/points.bin');
  const buf = await res.arrayBuffer();
  const header = new DataView(buf, 0, 8);
  const count = header.getUint32(0, true);
  const numClusters = header.getUint32(4, true);
  const x = new Float32Array(buf, 8, count);
  const y = new Float32Array(buf, 8 + count * 4, count);
  const clusters = new Uint16Array(buf, 8 + count * 8, count);
  return { count, numClusters, x, y, clusters };
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ annotations }) => {
  const [data, setData] = useState<PointData | null>(null);

  useEffect(() => {
    loadPoints().then(setData);
  }, []);

  if (!data) return <div>Loading 2.3M points...</div>;

  // Group points by cluster for coloring
  const traces: Plotly.Data[] = [];
  const buckets = new Map<number, { x: number[]; y: number[] }>();
  for (let i = 0; i < data.count; i++) {
    const c = data.clusters[i];
    let bucket = buckets.get(c);
    if (!bucket) {
      bucket = { x: [], y: [] };
      buckets.set(c, bucket);
    }
    bucket.x.push(data.x[i]);
    bucket.y.push(data.y[i]);
  }

  for (const [clusterId, bucket] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const label = annotations[String(clusterId)];
    traces.push({
      x: bucket.x,
      y: bucket.y,
      type: 'scattergl',
      mode: 'markers',
      marker: { color: PALETTE[clusterId % PALETTE.length], size: 2, opacity: 0.5 },
      name: label ? `${clusterId}: ${label}` : `Cluster ${clusterId}`,
      hoverinfo: 'name',
    });
  }

  return (
    <Plot
      data={traces}
      layout={{
        title: { text: 'Deck Embeddings (UMAP 2D)' },
        width: 1200,
        height: 800,
        showlegend: true,
        legend: { font: { size: 9 }, orientation: 'v' },
        xaxis: { title: { text: 'UMAP-1' } },
        yaxis: { title: { text: 'UMAP-2' } },
      }}
      config={{ responsive: true }}
    />
  );
};

export default ScatterPlot;
