import React, { AnchorHTMLAttributes } from 'react';

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
  outline?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
  block?: boolean;
}

const ButtonLink: React.FC<ButtonLinkProps> = ({ children, outline, color = 'primary', block, ...props }) => {
  const type = outline ? `btn-outline-${color}` : `btn-${color}`;

  const link = (
    <a className={`btn ${type} my-1`} {...props} role="button">
      {children}
    </a>
  );
  if (block) return <div className="d-grid">{link}</div>;
  return link;
};

export default ButtonLink;
