import React from 'react';
import classNames from 'classnames';
import AspectRatioBox from './AspectRatioBox';

interface TileProps {
  className?: string;
  children: React.ReactNode;
  href: string;
}

const Tile: React.FC<TileProps> = ({ className, children, href }) => {
  return (
    <a
      href={href}
      className={classNames(
        'block bg-bg-accent shadow overflow-hidden border border-border',
        'hover:bg-bg-active cursor-pointer hover:border-border-active',
        className,
      )}
    >
      <AspectRatioBox ratio={1}>{children}</AspectRatioBox>
    </a>
  );
};

export { Tile };
