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
  // With no pages there is no page to honestly label, so no control may offer to navigate to one
  const isEmpty = count < 1;
  const label = isEmpty ? 'No results' : `Page ${active + 1} of ${count}`;
  const backDisabled = isEmpty || active === 0 || loading;
  const forwardDisabled = isEmpty || active === count - 1 || loading;

  if (urlF) {
    return (
      <Flexbox
        direction="row"
        gap="2"
        alignItems="center"
        justify={justifyBetween ? 'between' : 'start'}
        className={className}
      >
        <Text semibold className={labelClass}>
          {label}
        </Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          <Button color="primary" href={urlF(0)} disabled={backDisabled}>
            <MoveToStartIcon size={16} />
          </Button>
          <Button color="primary" href={urlF(active - 1)} disabled={backDisabled}>
            <ArrowLeftIcon size={16} />
          </Button>
          <Button color="primary" href={urlF(active + 1)} disabled={forwardDisabled}>
            <ArrowRightIcon size={16} />
          </Button>
          <Button color="primary" href={urlF(count - 1)} disabled={forwardDisabled}>
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
        <Text semibold className={labelClass}>
          {label}
        </Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          {loading && <Spinner sm />}
          <Button color="primary" onClick={() => onClick(0)} disabled={backDisabled}>
            <MoveToStartIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(active - 1)} disabled={backDisabled}>
            <ArrowLeftIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(active + 1)} disabled={forwardDisabled}>
            <ArrowRightIcon size={16} />
          </Button>
          <Button color="primary" onClick={() => onClick(count - 1)} disabled={forwardDisabled}>
            <MoveToEndIcon size={16} />
          </Button>
        </Flexbox>
      </Flexbox>
    );
  }
  return (
    <Text semibold className={className}>
      {label}
    </Text>
  );
};

export default Paginate;
