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
}

export const Modal: React.FC<ModalProps> = ({ children, isOpen, setOpen, sm, md, lg, xl }) => {
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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>
        <div className="fixed inset-0 z-30 overflow-y-auto">
          <div className="flex min-h-full justify-center text-center items-start">
            <div
              className={classNames(`grow`, {
                'max-w-sm': sm,
                'max-w-md': md,
                'max-w-lg': lg,
                'max-w-xl': xl,
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
                <div className="max-h-screen p-4">
                  <DialogPanel className="relative transform overflow-hidden rounded-md bg-white text-left shadow-xl transition-all w-full flex flex-col max-h-modal">
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
    <div
      className={`bg-neutral-100 text-neutral-700 font-semibold text-xl p-2 border-b border-neutral-300 flex ${className}`}
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
  return <div className={classNames('p-3 border-t border-neutral-300 flex', className)}>{children}</div>;
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
        'overflow-auto grow border-y': !fixed,
        [className]: !!className,
      })}
    >
      {children}
    </div>
  );
};
