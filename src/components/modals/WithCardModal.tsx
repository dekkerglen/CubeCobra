import React, { useCallback, useContext } from 'react';

import CubeContext from 'contexts/CubeContext';
import { BoardType } from 'datatypes/Card';

export interface WithCardModalProps {
  children?: React.ReactNode;
  className?: string;
  altClick?: () => void;
  modalprops: {
    card: {
      board?: BoardType;
      index?: number;
    };
  };
}

const withCardModal = <P,>(Tag: React.ComponentType<P>) => {
  const Result = (props: WithCardModalProps & P) => {
    const { setModalSelection, setModalOpen } = useContext(CubeContext)!;

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (props.altClick && event.ctrlKey) {
          props.altClick();
        } else {
          event.preventDefault();
          const { board, index } = props.modalprops.card;
          if (board !== undefined && index !== undefined) setModalSelection({ board, index });
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
  Result.displayName = `withCardModal(${Tag.displayName ?? ''})`;
  return Result;
};

export default withCardModal;
