import React from 'react';

import { XIcon } from '@primer/octicons-react';
import classNames from 'classnames';
interface TagProps {
  href?: string;
  style?: React.CSSProperties;
  text: string;
  colorClass?: string;
  // Inline background/text color for custom (hex) tag colors; wins over base styles.
  colorStyle?: React.CSSProperties;
  onDelete?: () => void;
}

const Tag: React.FC<TagProps> = ({ href, style, text, onDelete, colorClass, colorStyle }) => {
  const baseClasses = 'text-sm p-2 m-1 inline-block border bg-bg-active border-border transition-all duration-300';
  const mergedStyle = { ...style, ...colorStyle };

  if (href) {
    return (
      <a
        href={href}
        className={classNames(
          colorClass,
          baseClasses,
          'hover:cursor-pointer font-medium text-link hover:text-link-active',
        )}
        style={mergedStyle}
      >
        {text}
      </a>
    );
  }

  return (
    <span className={classNames(colorClass, baseClasses)} style={mergedStyle}>
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
