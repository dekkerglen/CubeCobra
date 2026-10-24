import React, { useEffect, useState } from 'react';

import classNames from 'classnames';

import Button, { ButtonProps } from './Button';
import Spinner from './Spinner';

/*
 * A button that POSTs to `action` and lets the browser follow the response, like a link would.
 * State-changing routes must not answer GET (an <img> in user Markdown could trigger them), so
 * anything that used to be an <a href> to such a route renders one of these instead. No CSRF
 * token is needed: a same-origin form post passes the server's CSRF guard on its own.
 */
export interface PostButtonProps {
  action: string;
  children: React.ReactNode;
  color?: ButtonProps['color'];
  outline?: boolean;
  block?: boolean;
  className?: string;
  // Render a bare <button> styled only by className, for text links in menus and nav bars.
  unstyled?: boolean;
  // If set, ask the user to confirm before submitting.
  confirm?: string;
  title?: string;
  'aria-label'?: string;
}

const PostButton: React.FC<PostButtonProps> = ({
  action,
  children,
  color,
  outline,
  block,
  className,
  unstyled = false,
  confirm,
  title,
  'aria-label': ariaLabel,
}) => {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // A page restored from the back/forward cache would otherwise stay stuck in the submitting state
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSubmitting(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (submitting || (confirm && !window.confirm(confirm))) {
      event.preventDefault();
      return;
    }
    setSubmitting(true);
  };

  return (
    <form method="POST" action={action} onSubmit={handleSubmit} className={classNames({ 'w-full': block })}>
      {unstyled ? (
        <button type="submit" className={classNames('cursor-pointer', className)} title={title} aria-label={ariaLabel}>
          {children}
        </button>
      ) : (
        <Button
          type="submit"
          color={color}
          outline={outline}
          block={block}
          className={classNames(className, { 'opacity-50 cursor-not-allowed': submitting })}
          title={title}
          aria-label={ariaLabel}
        >
          {submitting ? <Spinner className="position-absolute" /> : children}
        </Button>
      )}
    </form>
  );
};

export default PostButton;
