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
  loading?: boolean;
  justifyBetween?: boolean;
  inverted?: boolean;
}

const Paginate: React.FC<PaginateProps> = ({
  count,
  active,
  urlF,
  onClick,
  loading = false,
  className,
  justifyBetween = false,
  inverted = false,
}) => {
  const labelClass = inverted ? 'mr-4 !text-button-text' : 'mr-4';

  if (urlF) {
    return (
      <Flexbox
        direction="row"
        gap="2"
        alignItems="center"
        justify={justifyBetween ? 'between' : 'start'}
        className={className}
      >
        <Text semibold className={labelClass}>{`Page ${active + 1} of ${count}`}</Text>
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
        <Text semibold className={labelClass}>{`Page ${active + 1} of ${count}`}</Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          {loading && <Spinner sm />}
          <Button color="primary" onClick={() => onClick(0)} disabled={active === 0 || loading}>
            <MoveToStartIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(active - 1)} disabled={active === 0 || loading}>
            <ArrowLeftIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(active + 1)} disabled={active === count - 1 || loading}>
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
