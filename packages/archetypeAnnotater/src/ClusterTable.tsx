import React, { useState } from 'react';

interface TopCard {
  oracleId: string;
  name: string;
  density: number;
  synergy: number;
}

interface ClusterSummary {
  clusterId: number;
  count: number;
  sampleDeckIds: string[];
  topCards: TopCard[];
}

interface ClusterTableProps {
  summaries: ClusterSummary[];
  annotations: Record<string, string>;
  onSaveLabel: (clusterId: number, label: string) => void;
}

const DECK_URL = 'https://cubecobra.com/cube/deck/';

const ClusterTable: React.FC<ClusterTableProps> = ({ summaries, annotations, onSaveLabel }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (clusterId: number) => {
    setEditingId(clusterId);
    setEditValue(annotations[String(clusterId)] || '');
  };

  const saveEdit = () => {
    if (editingId !== null) {
      onSaveLabel(editingId, editValue.trim());
      setEditingId(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
          <th style={{ padding: '6px 8px' }}>Cluster</th>
          <th style={{ padding: '6px 8px' }}>Label</th>
          <th style={{ padding: '6px 8px' }}>Count</th>
          <th style={{ padding: '6px 8px' }}>Top Cards (by synergy)</th>
          <th style={{ padding: '6px 8px' }}>Sample Decks</th>
          <th style={{ padding: '6px 8px' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {summaries.map((s) => (
          <tr key={s.clusterId} style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{s.clusterId}</td>
            <td style={{ padding: '6px 8px' }}>
              {editingId === s.clusterId ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  style={{ width: '200px', padding: '2px 4px' }}
                />
              ) : (
                <span style={{ color: annotations[String(s.clusterId)] ? '#000' : '#aaa' }}>
                  {annotations[String(s.clusterId)] || '(unlabeled)'}
                </span>
              )}
            </td>
            <td style={{ padding: '6px 8px' }}>{s.count.toLocaleString()}</td>
            <td style={{ padding: '6px 8px', maxWidth: '500px' }}>
              {s.topCards.slice(0, 20).map((card, i) => (
                <span
                  key={card.oracleId}
                  title={`Density: ${(card.density * 100).toFixed(1)}% | Synergy: ${(card.synergy * 100).toFixed(1)}%`}
                >
                  {i > 0 && ', '}
                  <span style={{ whiteSpace: 'nowrap' }}>
                    {card.name}
                    <span style={{ color: '#888', fontSize: '11px' }}> {(card.density * 100).toFixed(0)}%</span>
                  </span>
                </span>
              ))}
            </td>
            <td style={{ padding: '6px 8px' }}>
              {s.sampleDeckIds.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <a href={`${DECK_URL}${id}`} target="_blank" rel="noopener noreferrer">
                    deck {i + 1}
                  </a>
                </span>
              ))}
            </td>
            <td style={{ padding: '6px 8px' }}>
              {editingId === s.clusterId ? (
                <>
                  <button onClick={saveEdit} style={{ marginRight: 4 }}>
                    Save
                  </button>
                  <button onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(s.clusterId)} style={{ marginRight: 4 }}>
                    {annotations[String(s.clusterId)] ? 'Edit' : 'Label'}
                  </button>
                  {annotations[String(s.clusterId)] && (
                    <button onClick={() => onSaveLabel(s.clusterId, '')}>Clear</button>
                  )}
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ClusterTable;
