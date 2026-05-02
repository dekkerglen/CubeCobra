import React from 'react';

import type { CardStats } from '@utils/datatypes/SimulationReport';

import { Col, Row } from '../base/Layout';
import Text from '../base/Text';

const DraftVsEloTable: React.FC<{
  cardStats: CardStats[];
  inDeckOracles?: Set<string> | null;
  titleSuffix?: string | null;
  renderCardLink: (oracleId: string, name: string) => React.ReactNode;
}> = ({ cardStats, inDeckOracles, titleSuffix, renderCardLink }) => {
  const picked = cardStats.filter(
    (c) => c.timesPicked > 0 && c.avgPickPosition > 0 && (!inDeckOracles || inDeckOracles.has(c.oracle_id)),
  );
  const eloRankMap = new Map([...picked].sort((a, b) => b.elo - a.elo).map((c, i) => [c.oracle_id, i + 1]));
  const draftRankMap = new Map(
    [...picked].sort((a, b) => a.avgPickPosition - b.avgPickPosition).map((c, i) => [c.oracle_id, i + 1]),
  );
  const rows = picked.map((c) => {
    const eloRank = eloRankMap.get(c.oracle_id) ?? 0;
    const draftRank = draftRankMap.get(c.oracle_id) ?? 0;
    return {
      oracle_id: c.oracle_id,
      name: c.name,
      elo: Math.round(c.elo),
      eloRank,
      draftRank,
      delta: eloRank - draftRank,
      avgPickPosition: c.avgPickPosition,
      pickRate: c.pickRate,
    };
  });
  const gainers = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 20);
  const losers = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 20);
  const cols = ['Card', 'Elo', 'Elo Rank', 'Draft Rank', 'Delta', 'Avg Position', 'Pick Rate'];

  const TableHead = () => (
    <thead className="bg-bg-accent">
      <tr>
        {cols.map((header, idx) => (
          <th
            key={header}
            className={[
              'px-3 py-2 text-xs font-medium uppercase tracking-wider',
              idx === 0 ? 'text-left' : 'text-right',
            ].join(' ')}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );

  const DataRow: React.FC<{ row: (typeof rows)[0] }> = ({ row }) => (
    <tr className="hover:bg-bg-active">
      <td className="px-3 py-2 font-medium">{renderCardLink(row.oracle_id, row.name)}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{row.elo}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">#{row.eloRank}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">#{row.draftRank}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className={row.delta > 0 ? 'text-green-400 font-medium' : row.delta < 0 ? 'text-red-400 font-medium' : ''}>
          {row.delta > 0 ? `+${row.delta}` : row.delta}
        </span>
      </td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{row.avgPickPosition.toFixed(1)}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{(row.pickRate * 100).toFixed(1)}%</td>
    </tr>
  );

  return (
    <Row className="gap-4">
      {[
        {
          title: `Overperformers${titleSuffix ? ` ${titleSuffix}` : ''}`,
          sub: 'Drafted earlier than their Elo suggests — picked more highly than expected.',
          data: gainers,
        },
        {
          title: `Underperformers${titleSuffix ? ` ${titleSuffix}` : ''}`,
          sub: 'Drafted later than their Elo suggests — picked lower than expected.',
          data: losers,
        },
      ].map(({ title, sub, data }) => (
        <Col key={title} xs={12} md={6}>
          <div className="h-full rounded border border-border bg-bg">
            <div className="border-b border-border bg-bg-accent/50 px-3 py-2 flex flex-col gap-0.5">
              <Text semibold>{title}</Text>
              <Text xs className="text-text-secondary">
                {sub}
              </Text>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <TableHead />
                <tbody className="divide-y divide-border">
                  {data.map((row) => (
                    <DataRow key={row.oracle_id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
};

export default DraftVsEloTable;
