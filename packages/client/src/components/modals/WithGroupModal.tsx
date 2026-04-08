import React, { useCallback, useContext } from 'react';

import Card, { BoardType } from '@utils/datatypes/Card';

import CubeContext from 'contexts/CubeContext';

export interface WithGroupModalProps {
  children: React.ReactNode;
  className?: string;
  altClick?: () => void;
  modalprops: {
    cards: Card[];
  };
}

const withGroupModal = <P,>(Tag: React.ComponentType<P>) => {
  const Result = (props: WithGroupModalProps & P) => {
    const { setModalSelection, setModalOpen } = useContext(CubeContext)!;
    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (props.altClick && event.ctrlKey) {
          props.altClick();
        } else {
          event.preventDefault();
          setModalSelection(
            props.modalprops.cards.filter((c) => c.board !== undefined && c.index !== undefined) as {
              index: number;
              board: BoardType;
            }[],
          );
          setModalOpen(true);
        }
      },
      [props, setModalOpen, setModalSelection],
    );

    return (
      <>
        <Tag
          {...props}
          className={props.className ? `${props.className} clickable` : 'clickable'}
          onClick={handleClick}
        >
          {props.children}
        </Tag>
      </>
    );
  };
  Result.displayName = `withGroupModal(${Tag.displayName ?? ''})`;
  return Result;
};

export default withGroupModal;
