import React, { forwardRef, ComponentType, ElementType } from 'react';

type PropsOf<T extends ElementType> =
  T extends ComponentType<infer P>
    ? P & React.ComponentProps<T>
    : T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : never;

type RefOf<T extends ElementType> =
  T extends ComponentType<any>
    ? React.ComponentPropsWithRef<T>['ref']
    : T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T] extends { ref?: infer R }
        ? R
        : never
      : never;

export function makeWrapper<T extends ElementType>(
  render: (props: PropsOf<T>, ref: React.ForwardedRef<RefOf<T>>) => JSX.Element,
) {
  type Props = PropsOf<T>;
  type Ref = RefOf<T>;

  const withWrapper = forwardRef<Ref, Props>((props, ref) => render(props as any, ref));

  // withWrapper.displayName = `withWrapper(${
  //   typeof WrappedComponent === 'string'
  //     ? WrappedComponent
  //     : WrappedComponent.displayName || WrappedComponent.name || 'Component'
  // })`;

  return withWrapper;
}

export default makeWrapper;
