import React, { useContext } from 'react';

import { HeartFillIcon, XIcon } from '@primer/octicons-react';
import { UserRoles } from '@utils/datatypes/User';

import UserContext from '../contexts/UserContext';
import useLocalStorage from '../hooks/useLocalStorage';
import { Card, CardBody } from './base/Card';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import Text from './base/Text';

interface UpgradePromptProps {
  /** Short, context-specific hook shown before the generic supporter pitch. */
  message: string;
  /**
   * Unique key used to remember when the visitor dismissed the prompt. Prompts
   * that share a key share dismissal state, so reuse a key to avoid nagging.
   */
  storageKey: string;
  /** Days to keep the prompt hidden after a dismissal before showing it again. */
  snoozeDays?: number;
  className?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A tasteful, dismissible prompt encouraging non-patrons to support Cube Cobra.
 * It is designed to be placed at high-satisfaction moments (e.g. just after a
 * draft finishes). It renders nothing for patrons, and nothing for visitors who
 * dismissed a prompt with the same storageKey within the last `snoozeDays`.
 */
const UpgradePrompt: React.FC<UpgradePromptProps> = ({ message, storageKey, snoozeDays = 30, className }) => {
  const user = useContext(UserContext);
  const [dismissedAt, setDismissedAt] = useLocalStorage<number>(`upgradePrompt:${storageKey}`, 0);

  // Patrons already support the site - never nag them.
  if (user && Array.isArray(user.roles) && user.roles.includes(UserRoles.PATRON)) {
    return null;
  }

  // Respect a recent dismissal.
  if (dismissedAt > 0 && Date.now() - dismissedAt < snoozeDays * DAY_MS) {
    return null;
  }

  return (
    <Card className={className}>
      <CardBody className="bg-advert rounded-md">
        <Flexbox direction="row" justify="between" alignItems="start" gap="3">
          <Flexbox direction="row" alignItems="start" gap="2">
            <span className="text-red-500 mt-1 flex-shrink-0">
              <HeartFillIcon size={16} />
            </span>
            <Text lg>
              <Text lg semibold>
                {message}
              </Text>{' '}
              Cube Cobra is kept running by players like you. Become a <Link href="/help/donate">supporter</Link> to
              remove ads, feature your cube, and unlock exclusive perks.
            </Text>
          </Flexbox>
          <button
            type="button"
            aria-label="Dismiss"
            className="flex-shrink-0 text-text-secondary hover:text-text"
            onClick={() => setDismissedAt(Date.now())}
          >
            <XIcon size={16} />
          </button>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default UpgradePrompt;
