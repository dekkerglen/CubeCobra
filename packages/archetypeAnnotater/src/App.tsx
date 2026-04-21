import React, { useCallback, useEffect, useState } from 'react';

import AnnotatePage from './AnnotatePage';
import ClusterTable from './ClusterTable';
import ScatterPlot from './ScatterPlot';

interface ClusterSummary {
  clusterId: number;
  count: number;
  sampleDeckIds: string[];
  topCards: { oracleId: string; name: string; density: number; synergy: number }[];
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

const App: React.FC = () => {
  const hash = useHash();

  if (hash === '#annotate') {
    return <AnnotatePage />;
  }

  return <OverviewPage />;
};

const OverviewPage: React.FC = () => {
  const [summaries, setSummaries] = useState<ClusterSummary[]>([]);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/data/app/clusterSummaries.json').then((r) => r.json()),
      fetch('/api/annotations').then((r) => r.json()),
    ]).then(([sums, anns]) => {
      setSummaries(sums);
      setAnnotations(anns);
      setLoading(false);
    });
  }, []);

  const handleSaveLabel = useCallback(
    (clusterId: number, label: string) => {
      const updated = { ...annotations, [String(clusterId)]: label };
      setAnnotations(updated);
      fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    },
    [annotations],
  );

  if (loading) return <div style={{ padding: '2rem' }}>Loading app data...</div>;

  const labeled = Object.values(annotations).filter((v) => v).length;

  return (
    <div style={{ padding: '1rem 2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Archetype Annotater</h1>
      <p>
        {summaries.length} clusters &middot; {summaries.reduce((a, s) => a + s.count, 0).toLocaleString()} decks
        &middot; {labeled}/{summaries.length} labeled &middot; <a href="#annotate">Open Annotation View</a>
      </p>

      <ScatterPlot annotations={annotations} />

      <h2 style={{ marginTop: '2rem' }}>Cluster Summary</h2>
      <ClusterTable summaries={summaries} annotations={annotations} onSaveLabel={handleSaveLabel} />
    </div>
  );
};

export default App;
