import React, { ReactNode } from 'react';

import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { XIcon } from '@primer/octicons-react';
import classNames from 'classnames';

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  xs?: boolean;
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  xxl?: boolean;
  //If you set scrollable on the modal also set it on the ModalBody
  scrollable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  setOpen,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  scrollable = false,
}) => {
  return (
    <Transition show={isOpen}>
      <Dialog as="div" className="relative z-30" onClose={() => setOpen(false)}>
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-bg bg-opacity-75 transition-opacity" />
        </TransitionChild>
        <div className="fixed inset-0 z-30">
          <div
            className={classNames('flex min-h-full justify-center text-center items-start max-h-screen overflow-auto')}
          >
            <div
              className={classNames(`grow`, {
                'max-w-screen-xs': xs,
                'max-w-screen-sm': sm,
                'max-w-screen-md': md,
                'max-w-screen-lg': lg,
                'max-w-screen-xl': xl,
                'max-w-screen-2xl': xxl,
              })}
            >
              <TransitionChild
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <div className="p-4 pb-20">
                  <DialogPanel
                    className={classNames(
                      'relative transform rounded-md border border-border bg-bg-accent text-left text-text shadow-xl transition-all w-full flex flex-col',
                      {
                        /* To be scrollable the modal must have a maximum height, and here we make it the whole viewport (minus some margin basically)
                         * 95% of the view port height (vh units) works well for both desktop and mobile
                         */
                        'overflow-hidden max-h-95/100': scrollable,
                      },
                    )}
                  >
                    {children}
                  </DialogPanel>
                </div>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
  setOpen: (open: boolean) => void;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ children, className = '', setOpen }) => {
  return (
    <div
      className={classNames({
        'bg-bg-accent-accent font-semibold text-xl p-2 flex': true,
        [className]: !!className,
      })}
    >
      {children}
      <button type="button" className="ml-auto" onClick={() => setOpen(false)}>
        <XIcon size={24} />
      </button>
    </div>
  );
};

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className }) => {
  return <div className={classNames('p-3 flex', className)}>{children}</div>;
};

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  fixed?: boolean;
  //If you set scrollable on the modal also set it on the Modal
  scrollable?: boolean;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
  fixed = false,
  scrollable = false,
}) => {
  return (
    <div
      className={classNames({
        'p-3': true,
        'border-y border-border': !fixed,
        //Sets the body to overflow so it can scroll, with flex so it grows
        'flex-1 overflow-y-auto': scrollable,
        grow: !scrollable,
        [className]: !!className,
      })}
    >
      {children}
    </div>
  );
};
