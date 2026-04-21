import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface TopCard {
  oracleId: string;
  name: string;
  density: number;
  synergy: number;
  globalRate: number;
}

interface ClusterSummary {
  clusterId: number;
  count: number;
  sampleDeckIds: string[];
  topCards: TopCard[];
}

const DECK_URL = 'https://cubecobra.com/cube/deck/';

const cardImageUrl = (name: string) => `https://cubecobra.com/tool/cardimage/${encodeURIComponent(name.toLowerCase())}`;

const AnnotatePage: React.FC = () => {
  const [summaries, setSummaries] = useState<ClusterSummary[]>([]);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [labelValue, setLabelValue] = useState('');
  const [showUnlabeledOnly, setShowUnlabeledOnly] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/data/app/clusterSummaries.json').then((r) => r.json()),
      fetch('/api/annotations').then((r) => r.json()),
    ]).then(([sums, anns]) => {
      sums.sort((a: ClusterSummary, b: ClusterSummary) => a.clusterId - b.clusterId);
      setSummaries(sums);
      setAnnotations(anns);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => (showUnlabeledOnly ? summaries.filter((s) => !annotations[String(s.clusterId)]) : summaries),
    [summaries, annotations, showUnlabeledOnly],
  );

  const cluster = filtered[currentIndex];

  useEffect(() => {
    if (cluster) {
      setLabelValue(annotations[String(cluster.clusterId)] || '');
    }
  }, [cluster, annotations]);

  const saveLabel = useCallback(() => {
    if (!cluster) return;
    const updated = { ...annotations, [String(cluster.clusterId)]: labelValue.trim() };
    setAnnotations(updated);
    fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }, [cluster, labelValue, annotations]);

  const saveAndNext = useCallback(() => {
    saveLabel();
    setCurrentIndex((i) => Math.min(i + 1, filtered.length - 1));
  }, [saveLabel, filtered.length]);

  const handleJump = useCallback(() => {
    const id = parseInt(jumpInput, 10);
    if (isNaN(id)) return;
    const idx = filtered.findIndex((s) => s.clusterId === id);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setJumpInput('');
    }
  }, [jumpInput, filtered]);

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>Loading...</div>;
  if (!cluster) return <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>No clusters to show.</div>;

  const labeled = Object.values(annotations).filter((v) => v).length;
  const currentLabel = annotations[String(cluster.clusterId)];

  return (
    <div style={{ padding: '1rem 2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 1600 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Annotate Clusters</h1>
        <a href="#" style={{ fontSize: 14 }}>
          &larr; Overview
        </a>
      </div>
      <p style={{ margin: '4px 0 12px', color: '#666' }}>
        {labeled}/{summaries.length} labeled &middot; Showing {currentIndex + 1} of {filtered.length}
        {showUnlabeledOnly && ' (unlabeled only)'}
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
          &larr; Prev
        </button>
        <button
          onClick={() => setCurrentIndex((i) => Math.min(filtered.length - 1, i + 1))}
          disabled={currentIndex >= filtered.length - 1}
        >
          Next &rarr;
        </button>
        <span style={{ margin: '0 8px', color: '#999' }}>|</span>
        <input
          type="text"
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJump();
          }}
          placeholder="Jump to ID..."
          style={{ width: 100, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button onClick={handleJump}>Go</button>
        <span style={{ margin: '0 8px', color: '#999' }}>|</span>
        <label>
          <input
            type="checkbox"
            checked={showUnlabeledOnly}
            onChange={(e) => {
              setShowUnlabeledOnly(e.target.checked);
              setCurrentIndex(0);
            }}
          />{' '}
          Unlabeled only
        </label>
      </div>

      {/* Cluster info + label editor */}
      <div style={{ background: '#f5f5f5', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>
            Cluster {cluster.clusterId}
            <span style={{ fontWeight: 'normal', fontSize: 16, marginLeft: 8, color: '#666' }}>
              ({cluster.count.toLocaleString()} decks)
            </span>
          </h2>
          {currentLabel && (
            <span
              style={{
                background: '#2563eb',
                color: '#fff',
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              {currentLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveAndNext();
            }}
            placeholder="Enter archetype label..."
            style={{
              padding: '6px 10px',
              fontSize: 16,
              width: 320,
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
            autoFocus
          />
          <button onClick={saveLabel} style={{ padding: '6px 12px' }}>
            Save
          </button>
          <button onClick={saveAndNext} style={{ padding: '6px 12px' }}>
            Save &amp; Next
          </button>
        </div>
      </div>

      {/* 10x4 card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          gap: 6,
        }}
      >
        {cluster.topCards.slice(0, 40).map((card) => (
          <div key={card.oracleId} style={{ textAlign: 'center' }}>
            <img
              src={cardImageUrl(card.name)}
              alt={card.name}
              title={[
                card.name,
                `Synergy: +${(card.synergy * 100).toFixed(1)}%`,
                `In-cluster: ${(card.density * 100).toFixed(1)}%`,
                `Global: ${((card.globalRate ?? 0) * 100).toFixed(1)}%`,
              ].join('\n')}
              style={{ width: '100%', borderRadius: 6 }}
              loading="lazy"
            />
            <div
              style={{
                fontSize: 10,
                marginTop: 2,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.name}
            </div>
            <div style={{ fontSize: 9, color: '#888' }}>+{(card.synergy * 100).toFixed(0)}% syn</div>
          </div>
        ))}
      </div>

      {/* Sample decks */}
      <div style={{ marginTop: 16, fontSize: 13 }}>
        <strong>Sample decks:</strong>{' '}
        {cluster.sampleDeckIds.slice(0, 5).map((id, i) => (
          <span key={id}>
            {i > 0 && ', '}
            <a href={`${DECK_URL}${id}`} target="_blank" rel="noopener noreferrer">
              deck {i + 1}
            </a>
          </span>
        ))}
      </div>
    </div>
  );
};

export default AnnotatePage;
