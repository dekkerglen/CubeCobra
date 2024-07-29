import React, { useCallback, useContext } from 'react';
import CubeContext from 'contexts/CubeContext';
import { BoardType } from 'datatypes/Card';

export interface WithCardModalProps {
  children?: React.ReactNode;
  className?: string;
  altClick?: () => void;
  modalProps: {
    card: {
      board?: BoardType;
      index?: number;
    };
  };
}

const withCardModal =
  <T extends React.ComponentType<any>>(Tag: T) =>
  (props: WithCardModalProps & React.ComponentProps<T>) => {
    const { setModalSelection, setModalOpen } = useContext(CubeContext)!;

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (props.altClick && event.ctrlKey) {
          props.altClick();
        } else {
          event.preventDefault();
          setModalSelection({ board: props.modalProps.card.board, index: props.modalProps.card.index });
          setModalOpen(true);
        }
      },
      [props.altClick, props.modalProps.card, setModalOpen, setModalSelection],
    );

    return (
      <>
        <Tag
          {...(props as any)}
          className={props.className ? `${props.className} clickable` : 'clickable'}
          onClick={handleClick}
        >
          {props.children}
        </Tag>
      </>
    );
  };

export default withCardModal;
