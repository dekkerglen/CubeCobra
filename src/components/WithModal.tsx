import { useCallback, useState, MouseEvent, ReactNode, ElementType, ComponentType, ComponentProps } from 'react';

export interface WithModalProps<U> {
  children: ReactNode;
  className?: string;
  modalProps: Omit<U, 'isOpen' | 'toggle'>;
  altClick?: () => void;
}

const withModal = <T extends ElementType, U>(Tag: T, ModalTag: ComponentType<U>) => {
  return (allProps: WithModalProps<U> & ComponentProps<T>) => {
    const { children, className, modalProps, altClick } = allProps;
    const [isOpen, setIsOpen] = useState(false);
    const toggle = useCallback(
      (event?: MouseEvent<HTMLElement>) => {
        if (event) {
          event.preventDefault();
        }
        setIsOpen(!isOpen);
      },
      [isOpen],
    );

    const handleClick = useCallback(
      (event: MouseEvent<HTMLElement>) => {
        // only prevent default if ctrl wasn't pressed
        if (altClick && event.ctrlKey) {
          return altClick();
        }

        event.preventDefault();
        return toggle();
      },
      [altClick, toggle],
    );

    return (
      <>
        <Tag
          {...(allProps as any)}
          className={className ? `${className} clickable` : 'clickable'}
          onClick={handleClick}
        >
          {children}
        </Tag>
        <ModalTag isOpen={isOpen} toggle={toggle} {...modalProps} />
      </>
    );
  };
};

export default withModal;
