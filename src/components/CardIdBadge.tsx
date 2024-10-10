import React, { useState } from 'react';
import { CheckIcon, PasteIcon } from '@primer/octicons-react';
import { Flexbox } from './base/Layout';

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
      <span className="whitespace-nowrap px-3 py-1 bg-bg-active text-text rounded-l-md">Card ID</span>
      <input className="flex-grow flex-shrink px-3 py-1 bg-bg border border-x text-text text-sm" value={id} disabled />
      <button className="px-3 py-1 hover:bg-bg-active text-text rounded-e-md min-w-fit" onClick={onCopyClick}>
        {copied ? <CheckIcon size={16} /> : <PasteIcon size={16} />}
      </button>
    </Flexbox>
  );
};

export default CardIdBadge;
