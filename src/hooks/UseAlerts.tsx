import React, { useCallback, useState } from 'react';
import { UncontrolledAlert, UncontrolledAlertProps } from 'reactstrap';

interface Alert {
  color: string;
  message: string;
}

interface AlertsProps extends UncontrolledAlertProps {
  alerts: Alert[];
}

export const Alerts: React.FC<AlertsProps> = ({ alerts, ...props }) =>
  alerts.map(({ color, message }, index) => (
    <UncontrolledAlert key={index} color={color} {...props}>
      {message}
    </UncontrolledAlert>
  ));

const useAlerts = (): { addAlert: (color: string, message: string) => void; alerts: Alert[] } => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback((color: string, message: string) => setAlerts((oldAlerts) => [...oldAlerts, { color, message }]), []);

  return { addAlert, alerts };
};

export default useAlerts;
