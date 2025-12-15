import React, { useCallback, useContext } from 'react';

import { BoardType } from '@utils/datatypes/Card';

import CubeContext from 'contexts/CubeContext';

export interface WithCardModalProps {
  children?: React.ReactNode;
  className?: string;
  altClick?: () => void;
  modalprops: {
    card: {
      board?: BoardType;
      index?: number;
      isNewlyAdded?: boolean;
      addIndex?: number;
      isSwapped?: boolean;
      swapIndex?: number;
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
          const { board, index, isNewlyAdded, addIndex, isSwapped, swapIndex } = props.modalprops.card;

          console.log(
            'board',
            board,
            'index',
            index,
            'isNewlyAdded',
            isNewlyAdded,
            'addIndex',
            addIndex,
            'isSwapped',
            isSwapped,
            'swapIndex',
            swapIndex,
          );
          if (board !== undefined && index !== undefined) {
            if (isNewlyAdded && addIndex !== undefined) {
              setModalSelection({ board, index, isNewlyAdded: true, addIndex });
            } else if (isSwapped && swapIndex !== undefined) {
              setModalSelection({ board, index, isSwapped: true, swapIndex });
            } else {
              setModalSelection({ board, index });
            }
          }
          setModalOpen(true);
        }
      },
      [props, setModalOpen, setModalSelection],
    );

    return (
      <Tag {...props} className={props.className ? `${props.className} clickable` : 'clickable'} onClick={handleClick}>
        {props.children}
      </Tag>
    );
  };
  Result.displayName = `withCardModal(${Tag.displayName ?? ''})`;
  return Result;
};

export default withCardModal;
