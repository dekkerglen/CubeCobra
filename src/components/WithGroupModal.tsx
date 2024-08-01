import React, { useCallback, useContext } from 'react';
import CubeContext from 'contexts/CubeContext';
import { BoardType } from 'datatypes/Card';

export interface WithGroupModalProps {
  children: React.ReactNode;
  className?: string;
  altClick?: () => void;
  modalProps: {
    cards: { board: BoardType; index: number }[];
  };
}

const withGroupModal =
  <P,>(Tag: React.ComponentType<P>) =>
  (props: WithGroupModalProps & P) => {
    const { setModalSelection, setModalOpen } = useContext(CubeContext)!;
    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (props.altClick && event.ctrlKey) {
          props.altClick();
        } else {
          event.preventDefault();
          setModalSelection(props.modalProps.cards);
          setModalOpen(true);
        }
      },
      [props.altClick, props.modalProps.cards, setModalOpen, setModalSelection],
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

export default withGroupModal;
