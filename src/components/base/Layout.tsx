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

export type NumCols = 3 | 4 | 5 | 6 | 10 | 12;
export interface RowProps {
  children: React.ReactNode;
  className?: string;
  noGutters?: boolean;
  xs?: NumCols;
  sm?: NumCols;
  md?: NumCols;
  lg?: NumCols;
  xl?: NumCols;
  xxl?: NumCols;
}

const Row: React.FC<RowProps> = ({ children, className = '', xs, sm, md, lg, xl, xxl, noGutters = false }) => {
  const numCols = xs || sm || md || lg || xl || xxl || 12;

  return (
    <div
      className={classNames(
        {
          'gap-4': !noGutters,
          'grid grid-cols-12': numCols === 12,
          'grid grid-cols-10': numCols === 10,
          'grid grid-cols-6': numCols === 6,
          'grid grid-cols-5': numCols === 5,
          'grid grid-cols-4': numCols === 4,
          'grid grid-cols-3': numCols === 3,
          'sm:grid-cols-12': sm === 12,
          'sm:grid-cols-10': sm === 10,
          'sm:grid-cols-6': sm === 6,
          'sm:grid-cols-5': sm === 5,
          'sm:grid-cols-4': sm === 4,
          'sm:grid-cols-3': sm === 3,
          'md:grid-cols-12': md === 12,
          'md:grid-cols-10': md === 10,
          'md:grid-cols-6': md === 6,
          'md:grid-cols-5': md === 5,
          'md:grid-cols-4': md === 4,
          'md:grid-cols-3': md === 3,
          'lg:grid-cols-12': lg === 12,
          'lg:grid-cols-10': lg === 10,
          'lg:grid-cols-6': lg === 6,
          'lg:grid-cols-5': lg === 5,
          'lg:grid-cols-4': lg === 4,
          'lg:grid-cols-3': lg === 3,
          'xl:grid-cols-12': xl === 12,
          'xl:grid-cols-10': xl === 10,
          'xl:grid-cols-6': xl === 6,
          'xl:grid-cols-5': xl === 5,
          'xl:grid-cols-4': xl === 4,
          'xl:grid-cols-3': xl === 3,
          '2xl:grid-cols-12': xxl === 12,
          '2xl:grid-cols-10': xxl === 10,
          '2xl:grid-cols-6': xxl === 6,
          '2xl:grid-cols-5': xxl === 5,
          '2xl:grid-cols-4': xxl === 4,
          '2xl:grid-cols-3': xxl === 3,
        },
        className,
      )}
    >
      {children}
    </div>
  );
};

export interface ColProps {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
  fixed?: number;
  children: React.ReactNode;
  className?: string;
}

const Col: React.FC<ColProps> = ({ xs, sm, md, lg, xl, xxl, children, className = '' }) => {
  const defaultVal = xs || sm || md || lg || xl || xxl || 12;

  const classes = classNames(
    {
      'col-span-1': defaultVal === 1,
      'col-span-2': defaultVal === 2,
      'col-span-3': defaultVal === 3,
      'col-span-4': defaultVal === 4,
      'col-span-5': defaultVal === 5,
      'col-span-6': defaultVal === 6,
      'col-span-7': defaultVal === 7,
      'col-span-8': defaultVal === 8,
      'col-span-9': defaultVal === 9,
      'col-span-10': defaultVal === 10,
      'col-span-11': defaultVal === 11,
      'col-span-12': defaultVal === 12,
      'sm:col-span-1': sm === 1,
      'sm:col-span-2': sm === 2,
      'sm:col-span-3': sm === 3,
      'sm:col-span-4': sm === 4,
      'sm:col-span-5': sm === 5,
      'sm:col-span-6': sm === 6,
      'sm:col-span-7': sm === 7,
      'sm:col-span-8': sm === 8,
      'sm:col-span-9': sm === 9,
      'sm:col-span-10': sm === 10,
      'sm:col-span-11': sm === 11,
      'sm:col-span-12': sm === 12,
      'md:col-span-1': md === 1,
      'md:col-span-2': md === 2,
      'md:col-span-3': md === 3,
      'md:col-span-4': md === 4,
      'md:col-span-5': md === 5,
      'md:col-span-6': md === 6,
      'md:col-span-7': md === 7,
      'md:col-span-8': md === 8,
      'md:col-span-9': md === 9,
      'md:col-span-10': md === 10,
      'md:col-span-11': md === 11,
      'md:col-span-12': md === 12,
      'lg:col-span-1': lg === 1,
      'lg:col-span-2': lg === 2,
      'lg:col-span-3': lg === 3,
      'lg:col-span-4': lg === 4,
      'lg:col-span-5': lg === 5,
      'lg:col-span-6': lg === 6,
      'lg:col-span-7': lg === 7,
      'lg:col-span-8': lg === 8,
      'lg:col-span-9': lg === 9,
      'lg:col-span-10': lg === 10,
      'lg:col-span-11': lg === 11,
      'lg:col-span-12': lg === 12,
      'xl:col-span-1': xl === 1,
      'xl:col-span-2': xl === 2,
      'xl:col-span-3': xl === 3,
      'xl:col-span-4': xl === 4,
      'xl:col-span-5': xl === 5,
      'xl:col-span-6': xl === 6,
      'xl:col-span-7': xl === 7,
      'xl:col-span-8': xl === 8,
      'xl:col-span-9': xl === 9,
      'xl:col-span-10': xl === 10,
      'xl:col-span-11': xl === 11,
      'xl:col-span-12': xl === 12,
      '2xl:col-span-1': xxl === 1,
      '2xl:col-span-2': xxl === 2,
      '2xl:col-span-3': xxl === 3,
      '2xl:col-span-4': xxl === 4,
      '2xl:col-span-5': xxl === 5,
      '2xl:col-span-6': xxl === 6,
      '2xl:col-span-7': xxl === 7,
      '2xl:col-span-8': xxl === 8,
      '2xl:col-span-9': xxl === 9,
      '2xl:col-span-10': xxl === 10,
      '2xl:col-span-11': xxl === 11,
      '2xl:col-span-12': xxl === 12,
    },
    className,
  );

  return <div className={classes}>{children}</div>;
};

export { Flexbox, Row, Col };
