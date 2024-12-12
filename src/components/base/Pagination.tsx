import React from 'react';
import { Flexbox } from './Layout';
import Text from './Text';

import { ArrowLeftIcon, ArrowRightIcon, MoveToStartIcon, MoveToEndIcon } from '@primer/octicons-react';
import Button from './Button';
import Spinner from './Spinner';

interface PaginateProps {
  count: number;
  active: number;
  urlF?: (index: number) => string;
  onClick?: (index: number) => void;
  className?: string;
  hasMore?: boolean;
  loading?: boolean;
}

const Paginate: React.FC<PaginateProps> = ({
  count,
  active,
  urlF,
  onClick,
  hasMore = false,
  loading = false,
  className,
}) => {
  if (urlF) {
    return (
      <Flexbox direction="row" gap="2" alignItems="center" className={className}>
        <Text semibold className="mr-4">{`Page ${active + 1} of ${count}`}</Text>
        <Button color="primary" href={urlF(0)} disabled={active === 0}>
          <MoveToStartIcon size={16} />
        </Button>
        <Button color="primary" href={urlF(active - 1)} disabled={active === 0}>
          <ArrowLeftIcon size={16} />
        </Button>
        <Button color="primary" href={urlF(active + 1)} disabled={active === count - 1}>
          <ArrowRightIcon size={16} />
        </Button>
        <Button color="primary" href={urlF(count - 1)} disabled={active === count - 1}>
          <MoveToEndIcon size={16} />
        </Button>
      </Flexbox>
    );
  }

  if (onClick) {
    return (
      <Flexbox direction="row" gap="2" alignItems="center" className={className}>
        <Text semibold className="mr-4">{`Page ${active + 1} of ${count}${hasMore ? '+' : ''}`}</Text>
        {loading && <Spinner sm />}
        <Button color="primary" onClick={() => onClick(0)} disabled={active === 0 && !loading}>
          <MoveToStartIcon size={16} />
        </Button>
        <Button color="primary" onClick={() => onClick(active - 1)} disabled={active === 0 && !loading}>
          <ArrowLeftIcon size={16} />
        </Button>
        <Button
          color="primary"
          onClick={() => onClick(active + 1)}
          disabled={active === count - 1 && hasMore === false && !loading}
        >
          <ArrowRightIcon size={16} />
        </Button>
        <Button color="primary" onClick={() => onClick(count - 1)} disabled={active === count - 1 && !loading}>
          <MoveToEndIcon size={16} />
        </Button>
      </Flexbox>
    );
  }
  return <Text semibold className={className}>{`Page ${active + 1} of ${count}`}</Text>;
};

export default Paginate;
