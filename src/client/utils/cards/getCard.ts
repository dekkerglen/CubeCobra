import { Dispatch, SetStateAction } from 'react';

import { UncontrolledAlertProps } from 'components/base/Alert';
import { CardDetails } from 'datatypes/Card';

interface GetCardResponse {
  success: 'true' | 'false';
  card: CardDetails;
}

export const getCard = async (
  csrfFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  defaultPrinting: string,
  name: string,
  setAlerts?: Dispatch<SetStateAction<UncontrolledAlertProps[]>>,
): Promise<CardDetails | null> => {
  if (name && name.length > 0) {
    const response = await csrfFetch(`/cube/api/getcardforcube`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        defaultPrinting,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const message = `Couldn't get card: ${response.status}.`;
      if (setAlerts) {
        setAlerts((alerts: UncontrolledAlertProps[]) => [...alerts, { color: 'danger', message }]);
      } else {
        // eslint-disable-next-line no-console -- Debugging
        console.error(message);
      }
      return null;
    }

    const json: GetCardResponse = await response.json();
    if (json.success !== 'true' || !json.card) {
      const message = `Couldn't find card [${name}].`;
      if (setAlerts) {
        setAlerts((alerts: UncontrolledAlertProps[]) => [...alerts, { color: 'danger', message }]);
      } else {
        // eslint-disable-next-line no-console -- Debugging
        console.error(message);
      }
      return null;
    }
    return json.card;
  }
  return null;
};
