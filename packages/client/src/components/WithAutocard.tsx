import React, { ElementType, forwardRef, ReactNode, useContext, useEffect, useRef } from 'react';

import Card from '@utils/datatypes/Card';

import AutocardContext from 'contexts/AutocardContext';
import DisplayContext from 'contexts/DisplayContext';

import TagColorContext from '../contexts/TagColorContext';

export interface WithAutocardProps {
  card?: Card;
  image?: string;
  children?: ReactNode;
}

/**
 * Hover previews need a real pointer and room to render. `any-hover` is used rather than
 * `pointer: coarse` so a touchscreen laptop with a mouse attached still gets previews.
 * Evaluated per event, so resizing the window or plugging in a mouse takes effect without
 * remounting every trigger on the page.
 */
const supportsHoverPreview = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.innerWidth < 768) {
    return false;
  }
  if (typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(any-hover: hover)').matches;
};

const withAutocard = <T extends ElementType>(Tag: T) => {
  const Result = forwardRef<T, WithAutocardProps & React.ComponentProps<T>>(({ card, image, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext);
    const { showCard, hideCard } = useContext(AutocardContext);
    const tagColors = useContext(TagColorContext);
    const token = useRef<number | null>(null);

    const show = (anchor?: HTMLElement | null) => {
      const preview = image ? ({ details: { image_normal: image } } as Card) : card;
      if (!preview || !supportsHoverPreview()) {
        return;
      }
      token.current = showCard(preview, showCustomImages, tagColors, anchor);
    };

    const hide = () => {
      if (token.current === null) {
        return;
      }
      hideCard(token.current);
      token.current = null;
    };

    // A trigger can unmount while still hovered — a list re-sorts, a filter changes, a
    // dropdown closes — and React fires no mouseleave for an element that no longer
    // exists, which would strand the preview on screen.
    useEffect(
      () => () => {
        if (token.current !== null) {
          hideCard(token.current);
        }
      },
      [hideCard],
    );

    // Consumer handlers are composed rather than overwritten. These used to be declared
    // before the prop spread, so a consumer-supplied onClick or onMouseEnter silently
    // replaced the preview's own handler.
    const rest = props as any;

    const callSupplied = (supplied: unknown, event: unknown) => {
      if (typeof supplied === 'function') {
        supplied(event);
      }
    };

    const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
      show();
      callSupplied(rest.onMouseEnter, event);
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
      hide();
      callSupplied(rest.onMouseLeave, event);
    };

    const handleFocus = (event: React.FocusEvent<HTMLElement>) => {
      // Keyboard focus only; clicking already focuses the trigger and the pointer path
      // covers that case. :focus-visible throws on browsers that don't know it.
      const target = event.currentTarget;
      let keyboardFocused = false;
      try {
        keyboardFocused = !!target?.matches?.(':focus-visible');
      } catch {
        keyboardFocused = false;
      }
      if (keyboardFocused) {
        show(target);
      }
      callSupplied(rest.onFocus, event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
      hide();
      callSupplied(rest.onBlur, event);
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      // On touch the browser synthesises a hover before the tap; clear anything it
      // managed to open.
      if (!supportsHoverPreview()) {
        hide();
      }
      callSupplied(rest.onClick, event);
    };

    return (
      <Tag
        ref={ref}
        {...rest}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
      />
    );
  });
  Result.displayName = `withAutocard(${typeof Tag === 'function' ? Tag.displayName : Tag.toString()})`;
  return Result;
};

export default withAutocard;
