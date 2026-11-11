import React from 'react';

import { PairingMethod } from '@utils/records/pairings';
import classNames from 'classnames';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

// Every way a round can be paired: the three the pairings make, plus pairing by hand.
export type PairingChoice = PairingMethod | 'manual';

const METHODS: Record<PairingChoice, { label: string; description: string }> = {
  across: { label: 'Across the table', description: 'Each player meets the one seated opposite.' },
  record: { label: 'By record', description: 'Players on the same record meet, avoiding rematches.' },
  random: { label: 'Random', description: 'Drawn at random, avoiding rematches.' },
  manual: { label: 'Manual', description: 'Pick a player on the table, then their opponent.' },
};

interface PairingMethodControlProps {
  methods: PairingChoice[];
  value: PairingChoice;
  onChange: (method: PairingChoice) => void;
  // Draws a fresh set of random pairings; only offered while pairing at random.
  onRedraw: () => void;
}

// How a round is paired, shared by the seating table and the Add Round dialog.
const PairingMethodControl: React.FC<PairingMethodControlProps> = ({ methods, value, onChange, onRedraw }) => (
  <Flexbox direction="col" gap="1">
    <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
      <div
        role="group"
        aria-label="Pairing method"
        className="inline-flex overflow-hidden rounded-md border border-border"
      >
        {methods.map((method) => (
          <button
            key={method}
            type="button"
            aria-pressed={value === method}
            onClick={() => onChange(method)}
            className={classNames('px-3 py-1 text-sm font-medium transition-colors', {
              'bg-button-primary text-white': value === method,
              'bg-bg hover:bg-bg-active': value !== method,
            })}
          >
            {METHODS[method].label}
          </button>
        ))}
      </div>
      {value === 'random' && (
        <button type="button" className="text-sm font-medium text-link hover:text-link-active" onClick={onRedraw}>
          Draw Again
        </button>
      )}
    </Flexbox>
    <Text xs className="text-text-secondary">
      {METHODS[value].description}
    </Text>
  </Flexbox>
);

export default PairingMethodControl;
