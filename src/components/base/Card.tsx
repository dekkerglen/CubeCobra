import React from 'react';
import classNames from 'classnames';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

interface CardHeaderProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ className, children }) => {
  return <div className={classNames('bg-bg-accent shadow rounded-md border border-border', className)}>{children}</div>;
};

const CardBody: React.FC<CardProps> = ({ className, children }) => {
  return <div className={classNames('p-4', className)}>{children}</div>;
};

const CardHeader: React.FC<CardHeaderProps> = ({ className, children, onClick }) => {
  return (
    <div className={classNames('py-2 px-4 border-b border-border', className)} onClick={onClick}>
      {children}
    </div>
  );
};

const CardFooter: React.FC<CardFooterProps> = ({ className, children }) => {
  return <div className={classNames('py-2 px-4 border-t border-border', className)}>{children}</div>;
};

export { Card, CardHeader, CardFooter, CardBody };
