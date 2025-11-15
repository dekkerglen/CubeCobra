import React, { useCallback, useState } from 'react';

import Alert from '../components/base/Alert';

interface Alert {
  color: string;
  message: string;
}

interface AlertsProps {
  alerts: Alert[];
}

export const Alerts: React.FC<AlertsProps> = ({ alerts, ...props }) =>
  alerts.map(({ color, message }, index) => (
    <Alert key={index} color={color} {...props}>
      {message}
    </Alert>
  ));

const useAlerts = (): {
  addAlert: (color: string, message: string) => void;
  dismissAlerts: () => void;
  alerts: Alert[];
} => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback(
    (color: string, message: string) => setAlerts((oldAlerts) => [...oldAlerts, { color, message }]),
    [],
  );

  const dismissAlerts = useCallback(() => setAlerts([]), []);

  return { addAlert, dismissAlerts, alerts };
};

export default useAlerts;
