import React from 'react';

import { ArrowLeftIcon, ArrowRightIcon, MoveToEndIcon, MoveToStartIcon } from '@primer/octicons-react';

import Button from './Button';
import { Flexbox } from './Layout';
import Spinner from './Spinner';
import Text from './Text';

interface PaginateProps {
  count: number;
  active: number;
  urlF?: (index: number) => string;
  onClick?: (index: number) => void;
  className?: string;
  hasMore?: boolean;
  loading?: boolean;
  justifyBetween?: boolean;
}

const Paginate: React.FC<PaginateProps> = ({
  count,
  active,
  urlF,
  onClick,
  hasMore = false,
  loading = false,
  className,
  justifyBetween = false,
}) => {
  if (urlF) {
    return (
      <Flexbox
        direction="row"
        gap="2"
        alignItems="center"
        justify={justifyBetween ? 'between' : 'start'}
        className={className}
      >
        <Text semibold className="mr-4">{`Page ${active + 1} of ${count}`}</Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          <Button color="primary" href={urlF(0)} disabled={active === 0 || loading}>
            <MoveToStartIcon size={16} />
          </Button>
          <Button color="primary" href={urlF(active - 1)} disabled={active === 0 || loading}>
            <ArrowLeftIcon size={16} />
          </Button>
          <Button color="primary" href={urlF(active + 1)} disabled={active === count - 1 || loading}>
            <ArrowRightIcon size={16} />
          </Button>
          <Button color="primary" href={urlF(count - 1)} disabled={active === count - 1 || loading}>
            <MoveToEndIcon size={16} />
          </Button>
        </Flexbox>
      </Flexbox>
    );
  }

  if (onClick) {
    return (
      <Flexbox
        direction="row"
        gap="2"
        alignItems="center"
        justify={justifyBetween ? 'between' : 'start'}
        className={className}
      >
        <Text semibold className="mr-4">{`Page ${active + 1} of ${count}${hasMore ? '+' : ''}`}</Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          {loading && <Spinner sm />}
          <Button color="primary" onClick={() => onClick(0)} disabled={active === 0 || loading}>
            <MoveToStartIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(active - 1)} disabled={active === 0 || loading}>
            <ArrowLeftIcon size={16} />
          </Button>
          <Button
            color="primary"
            onClick={() => onClick(active + 1)}
            disabled={(active === count - 1 && hasMore === false) || loading}
          >
            <ArrowRightIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(count - 1)} disabled={active === count - 1 || loading}>
            <MoveToEndIcon size={16} />
          </Button>
        </Flexbox>
      </Flexbox>
    );
  }
  return <Text semibold className={className}>{`Page ${active + 1} of ${count}`}</Text>;
};

export default Paginate;
