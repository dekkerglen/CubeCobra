import React, { useState } from 'react';
import { CheckIcon, PasteIcon } from '@primer/octicons-react';
import { Flexbox } from 'components/base/Layout';

interface CardIdBadgeProps {
  id: string;
}

const CardIdBadge: React.FC<CardIdBadgeProps> = ({ id }) => {
  const [copied, setCopied] = useState(false);

  const onCopyClick = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
  };

  return (
    <Flexbox direction="row" justify="between" className="border border-border rounded-md">
      <input className="rounded-s-md flex-grow flex-shrink px-3 py-1 bg-bg text-text text-sm" value={id} disabled />
      <button className="px-3 py-1 hover:bg-bg-active text-text rounded-e-md min-w-fit" onClick={onCopyClick}>
        {copied ? <CheckIcon size={16} /> : <PasteIcon size={16} />}
      </button>
    </Flexbox>
  );
};

export default CardIdBadge;
