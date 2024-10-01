import React from 'react';
import classNames from 'classnames';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

interface CardHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ className, children }) => {
  return <div className={classNames('bg-bg shadow rounded-lg overflow-hidden', className)}>{children}</div>;
};

const CardHeader: React.FC<CardHeaderProps> = ({ className, children }) => {
  return <div className={classNames('px-1 py-2 border-b border-border', className)}>{children}</div>;
};

const CardFooter: React.FC<CardFooterProps> = ({ className, children }) => {
  return <div className={classNames('px-1 py-2 border-t border-border', className)}>{children}</div>;
};

export { Card, CardHeader, CardFooter };
