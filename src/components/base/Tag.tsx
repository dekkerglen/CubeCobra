import React from 'react';
import classNames from 'classnames';

interface TagProps {
  href?: string;
  style?: React.CSSProperties;
  text: string;
}

const Tag: React.FC<TagProps> = ({ href, style, text }) => {
  const baseClasses = 'text-sm p-2 m-1 inline-block border bg-bg-active border-border transition-all duration-300';

  if (href) {
    return (
      <a
        href={href}
        className={classNames(baseClasses, 'hover:cursor-pointer font-medium text-link hover:text-link-active')}
        style={style}
      >
        {text}
      </a>
    );
  }

  return (
    <span className={classNames(baseClasses)} style={style}>
      {text}
    </span>
  );
};

export default Tag;
