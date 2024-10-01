import React from 'react';
import classNames from 'classnames';

interface FlexboxProps {
  direction?: 'row' | 'row-reverse' | 'col' | 'col-reverse';
  wrap?: 'wrap' | 'wrap-reverse' | 'nowrap';
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  alignItems?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  alignContent?: 'start' | 'end' | 'center' | 'between' | 'around' | 'stretch';
  gap?:
    | '0'
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '10'
    | '11'
    | '12'
    | '14'
    | '16'
    | '20'
    | '24'
    | '28'
    | '32'
    | '36'
    | '40'
    | '44'
    | '48'
    | '52'
    | '56'
    | '60'
    | '64'
    | '72'
    | '80'
    | '96';
  children: React.ReactNode;
  className?: string;
}

const Flexbox: React.FC<FlexboxProps> = ({
  direction = 'row',
  wrap = 'nowrap',
  justify = 'start',
  alignItems = 'stretch',
  alignContent = 'stretch',
  gap = '0',
  children,
  className = '',
}) => {
  const classes = classNames(
    'flex',
    `flex-${direction}`,
    `flex-${wrap}`,
    `justify-${justify}`,
    `items-${alignItems}`,
    `content-${alignContent}`,
    `gap-${gap}`,
    className,
  );

  return <div className={classes}>{children}</div>;
};

export default Flexbox;
