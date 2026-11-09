import React, { useState } from 'react';

import { ArrowRightIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import { Card, CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';

import { ListSummary, PlaygroundError } from './types';

type Group = 'missing' | 'substituted' | 'unknown';

const GROUP_LABELS: Record<Group, string> = {
  missing: 'Not found',
  substituted: 'Substituted',
  unknown: 'Not in model',
};

const cardLink = (cardID: string, name: string) => (
  <Link href={`/tool/card/${cardID}`} target="_blank" rel="noopener noreferrer">
    {name}
  </Link>
);

interface ListReportProps {
  label?: string;
  summary: ListSummary;
}

/** How a pasted list resolved: its size, and the cards the model didn't see as pasted. */
const ListReport: React.FC<ListReportProps> = ({ label, summary }) => {
  const [open, setOpen] = useState<Group | null>(null);

  const total = summary.cards.reduce((sum, card) => sum + card.count, 0);
  const groups: Record<Group, number> = {
    missing: summary.missing.length,
    substituted: summary.cards.filter((card) => card.status === 'substituted').length,
    unknown: summary.cards.filter((card) => card.status === 'unknown').length,
  };

  let details: React.ReactNode = null;
  if (open === 'missing') {
    details = summary.missing.map((line, index) => <li key={index}>{line}</li>);
  } else if (open === 'substituted') {
    details = summary.cards
      .filter((card) => card.status === 'substituted')
      .map((card) => (
        <li key={card.oracle} className="flex items-center gap-2 flex-wrap">
          {cardLink(card.cardID, card.name)}
          <ArrowRightIcon size={12} className="text-text-secondary" />
          {card.substituteID && card.substituteName ? cardLink(card.substituteID, card.substituteName) : null}
        </li>
      ));
  } else if (open === 'unknown') {
    details = summary.cards
      .filter((card) => card.status === 'unknown')
      .map((card) => <li key={card.oracle}>{cardLink(card.cardID, card.name)}</li>);
  }

  return (
    <Flexbox direction="col" gap="1">
      <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
        <Text sm semibold>
          {label ? `${label} · ` : ''}
          {total === 1 ? '1 card' : `${total.toLocaleString()} cards`}
        </Text>
        {(Object.keys(GROUP_LABELS) as Group[])
          .filter((group) => groups[group] > 0)
          .map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setOpen(open === group ? null : group)}
              aria-expanded={open === group}
              className={classNames(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                group === 'substituted' ? 'border-border text-text' : 'border-button-danger text-button-danger',
                open === group ? 'bg-bg-active' : 'hover:bg-bg-active',
              )}
            >
              {GROUP_LABELS[group]} · {groups[group]}
            </button>
          ))}
      </Flexbox>
      {details && (
        <ul className="ml-1 pl-3 border-l-2 border-border text-sm flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          {details}
        </ul>
      )}
    </Flexbox>
  );
};

export default ListReport;

const ERROR_HEADINGS: Record<PlaygroundError['kind'], string | null> = {
  'ml-unavailable': 'Recommender unavailable',
  'rate-limited': null,
  invalid: null,
  generic: 'Something went wrong',
};

export const ErrorNotice: React.FC<{ error: PlaygroundError }> = ({ error }) => {
  const heading = ERROR_HEADINGS[error.kind];
  return (
    <Card>
      <CardBody>
        <Flexbox direction="col" gap="1" alignItems="start">
          {heading && (
            <Text lg semibold>
              {heading}
            </Text>
          )}
          <Text sm className={heading ? 'text-text-secondary' : 'text-button-danger'}>
            {error.message}
          </Text>
        </Flexbox>
      </CardBody>
    </Card>
  );
};
