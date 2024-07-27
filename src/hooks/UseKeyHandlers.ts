import { useMemo } from 'react';

interface KeyHandlerProps {
  role: 'button';
  onClick: (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

const useKeyHandlers = (handler: (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void): KeyHandlerProps =>
  useMemo(
    () => ({
      role: 'button',
      onClick: handler,
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if ([13, 32].includes(event.keyCode)) {
          handler(event);
        }
      },
    }),
    [handler],
  );

export default useKeyHandlers;
