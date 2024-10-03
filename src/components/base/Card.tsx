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
  return (
    <div className={classNames('bg-bg-accent shadow rounded-md overflow-hidden border border-border', className)}>
      {children}
    </div>
  );
};

const CardBody: React.FC<CardProps> = ({ className, children }) => {
  return <div className={classNames('p-4', className)}>{children}</div>;
};

const CardHeader: React.FC<CardHeaderProps> = ({ className, children }) => {
  return <div className={classNames('py-2 px-4 border-b border-border', className)}>{children}</div>;
};

const CardFooter: React.FC<CardFooterProps> = ({ className, children }) => {
  return <div className={classNames('py-2 px-4 border-t border-border', className)}>{children}</div>;
};

export { Card, CardHeader, CardFooter, CardBody };
