import React, { useContext, forwardRef, ComponentType, ElementType } from 'react';

import DisplayContext from 'contexts/DisplayContext';
import AutocardContext from 'contexts/AutocardContext';
import Card from 'datatypes/Card';

type PropsOf<T extends ElementType> =
  T extends ComponentType<infer P>
    ? P & React.ComponentProps<T>
    : T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : never;

export interface WithAutocardProps {
  card?: Card;
  image?: string;
  inModal?: boolean;
}

// const withAutocard = <P extends WithAutocardProps, C>(Tag: React.JSXElementConstructor<P> & C) => {
//   type Props = React.JSX.LibraryManagedAttributes<C, Omit<P, keyof WithAutocardProps>>;
//   return (props: Props) => <Tag {...(props as any)} />;
// };

const withAutocard = <T extends ElementType>(Tag: T) =>
  forwardRef<T, WithAutocardProps & PropsOf<T>>(({ card, image, inModal, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext);
    const { showCard, hideCard } = useContext(AutocardContext);

    return (
      <Tag
        ref={ref}
        onMouseEnter={() => showCard(image ? { details: { image_normal: image } } : card, inModal, showCustomImages)}
        onMouseLeave={() => hideCard()}
        {...(props as any)}
      />
    );
  });

export default withAutocard;
