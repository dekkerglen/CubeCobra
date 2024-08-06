import React, { FunctionComponent, useMemo, useState } from 'react';
import { Spinner } from 'reactstrap';

import { fromEntries } from 'utils/Util';

interface WithLoadingProps {
  loading: boolean | null;
  spinnerSize?: string;
  opacity?: number;
}

const withLoading = <T extends React.ComponentType>(Tag: FunctionComponent<T>, handlers?: string[]) => {
  const LoadingWrapped: React.FC<WithLoadingProps & React.ComponentProps<T>> = ({
    loading = false,
    spinnerSize,
    opacity = 0.7,
    ...props
  }) => {
    const [stateLoading, setLoading] = useState(false);

    const wrappedHandlers = useMemo(
      () =>
        fromEntries(
          (handlers ?? []).map((name) => [
            name,
            async (event: Event) => {
              setLoading(true);
              // @ts-expect-error figure out later
              await props[name](event);
              setLoading(false);
            },
          ]),
        ),

      // @ts-expect-error figure out later
      // eslint-disable-next-line react-hooks/exhaustive-deps
      handlers?.map((name) => props[name]),
    );

    const renderLoading = loading === null ? stateLoading : loading;

    return (
      <div className="d-flex justify-content-center align-items-center flex-grow-1">
        {renderLoading && <Spinner size={spinnerSize} className="position-absolute" style={{ opacity }} />}
        <Tag disabled={renderLoading} {...(props as any)} {...wrappedHandlers} />
      </div>
    );
  };

  return LoadingWrapped;
};

export default withLoading;
