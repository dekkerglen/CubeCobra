import React, { ReactNode } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import classNames from 'classnames';

import { XIcon } from '@primer/octicons-react';

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  xxl?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ children, isOpen, setOpen, sm, md, lg, xl, xxl }) => {
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
                  <DialogPanel className="relative transform rounded-md border border-border bg-bg-accent text-left text-text shadow-xl transition-all w-full flex flex-col max-h-modal">
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

export const ModalHeader: React.FC<ModalHeaderProps> = ({ children, className, setOpen }) => {
  return (
    <div className={`bg-bg-accent-accent font-semibold text-xl p-2 flex ${className}`}>
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
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '', fixed = false }) => {
  return (
    <div
      className={classNames({
        'p-3': true,
        'grow border-y border-border': !fixed,
        [className]: !!className,
      })}
    >
      {children}
    </div>
  );
};
