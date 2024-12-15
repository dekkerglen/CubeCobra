import React from 'react';
import classNames from 'classnames';

import { XIcon } from '@primer/octicons-react';
interface TagProps {
  href?: string;
  style?: React.CSSProperties;
  text: string;
  colorClass?: string;
  onDelete?: () => void;
}

const Tag: React.FC<TagProps> = ({ href, style, text, onDelete, colorClass }) => {
  const baseClasses = 'text-sm p-2 m-1 inline-block border bg-bg-active border-border transition-all duration-300';

  if (href) {
    return (
      <a
        href={href}
        className={classNames(
          colorClass,
          baseClasses,
          'hover:cursor-pointer font-medium text-link hover:text-link-active',
        )}
        style={style}
      >
        {text}
      </a>
    );
  }

  return (
    <span className={classNames(colorClass, baseClasses)} style={style}>
      {text}
      {onDelete && (
        <button className="ml-1" onClick={onDelete}>
          <XIcon size={16} />
        </button>
      )}
    </span>
  );
};

export default Tag;
