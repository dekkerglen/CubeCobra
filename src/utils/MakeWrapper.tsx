import React, { ComponentType, FC, PropsWithChildren } from 'react';

type DivWrapperProps = {
  wrapperClassName?: string;
};

function withDivWrapper<C extends ComponentType<any>>(WrappedComponent: C): FC<PropsWithChildren<DivWrapperProps & React.ComponentProps<C>>> {
  return function WithDivWrapper({ wrapperClassName, children, ...props }) {
    return (
      <div className={wrapperClassName}>
        <WrappedComponent {...props}>
          {children}
        </WrappedComponent>
      </div>
    );
  };
}

function withDivWrapperHTML<T extends keyof JSX.IntrinsicElements>(tagName: T): FC<PropsWithChildren<DivWrapperProps & JSX.IntrinsicElements[T]>> {
  return function WithDivWrapper({ wrapperClassName, children, ...props }) {
    return (
      <div className={wrapperClassName}>
        {React.createElement(tagName, props, children)}
      </div>
    );
  };
}

// Example usage:
const MyComponent: FC<{ name: string, children: string }> = ({ name, children }) => (
  <span>{name}: {children}</span>
);

const EnhancedComponent = withDivWrapper(MyComponent);
const EnhancedDiv = withDivWrapperHTML('div');

// These will typecheck correctly:
<EnhancedComponent name="John" wrapperClassName="wrapper">Hello</EnhancedComponent>
<EnhancedDiv id="my-div" wrapperClassName="wrapper">World</EnhancedDiv>