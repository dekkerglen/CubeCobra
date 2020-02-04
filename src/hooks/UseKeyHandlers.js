import { useMemo } from 'react';

const useKeyHandlers = (handler) =>
  useMemo(
    () => ({
      role: 'button',
      onClick: handler,
      onKeyDown: (event) => {
        if ([13, 32].includes(event.keyCode)) {
          handler(event);
        }
      },
    }),
    [handler],
  );

export default useKeyHandlers;
