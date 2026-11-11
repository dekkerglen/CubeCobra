import React, { useContext, useEffect, useState } from 'react';

import Alert from 'components/base/Alert';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import { CSRFContext } from 'contexts/CSRFContext';

export const AdminTabSpinner: React.FC = () => (
  <Flexbox direction="row" justify="center" className="w-full py-4">
    <Spinner />
  </Flexbox>
);

interface AdminTabDataProps<T> {
  url: string;
  children: (data: T) => React.ReactNode;
}

/** Fetches a dashboard tab's data from its GET endpoint when the tab first opens, then renders it. */
const AdminTabData = <T,>({ url, children }: AdminTabDataProps<T>): React.ReactElement => {
  const { csrfFetch } = useContext(CSRFContext);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await csrfFetch(url, { method: 'GET' });
        const json = await response.json();
        if (cancelled) return;
        if (response.ok && json.success) {
          setData(json);
        } else {
          setError(json.error || 'Request failed');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Request failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csrfFetch, url]);

  if (error) return <Alert color="danger">{error}</Alert>;
  if (data === null) return <AdminTabSpinner />;
  return <>{children(data)}</>;
};

export default AdminTabData;
