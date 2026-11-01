import React from 'react';

import { ArrowLeftIcon, ArrowRightIcon } from '@primer/octicons-react';

import Button from './Button';
import { Flexbox } from './Layout';
import Spinner from './Spinner';
import Text from './Text';

interface CursorPaginationProps {
  active: number;
  loadedPages: number;
  hasMore?: boolean;
  onPageChange: (index: number) => void;
  loading?: boolean;
  className?: string;
  inverted?: boolean;
  justifyBetween?: boolean;
}

/**
 * Pager for cursor-backed lists, where the total number of pages is unknowable.
 * `loadedPages` is how many pages have been fetched so far, never a total, so no
 * denominator is rendered.
 */
const CursorPagination: React.FC<CursorPaginationProps> = ({
  active,
  loadedPages,
  hasMore = false,
  onPageChange,
  loading = false,
  className,
  inverted = false,
  justifyBetween = false,
}) => {
  const labelClass = inverted ? 'mr-4 !text-button-text' : 'mr-4';
  // The list can shrink under the viewer, leaving active past the end of what is loaded
  const clampedActive = Math.max(0, Math.min(active, Math.max(0, loadedPages - 1)));

  if (loadedPages <= 1 && !hasMore) {
    return null;
  }

  return (
    <Flexbox
      direction="row"
      gap="2"
      alignItems="center"
      justify={justifyBetween ? 'between' : 'start'}
      className={className}
    >
      <Text semibold className={labelClass}>{`Page ${clampedActive + 1}`}</Text>
      <Flexbox direction="row" gap="2" alignItems="center">
        {loading && <Spinner sm />}
        <Button
          color="primary"
          aria-label="Previous page"
          onClick={() => onPageChange(clampedActive - 1)}
          disabled={clampedActive === 0 || loading}
        >
          <ArrowLeftIcon size={16} />
        </Button>
        <Button
          color="primary"
          aria-label="Next page"
          onClick={() => onPageChange(clampedActive + 1)}
          disabled={loading || (!hasMore && clampedActive + 1 >= loadedPages)}
        >
          <ArrowRightIcon size={16} />
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export default CursorPagination;
