import React, { useCallback, useState } from 'react';

import { UncontrolledAlert } from 'reactstrap';

export const Alerts = ({ alerts, ...props }) =>
  alerts.map(({ color, message }, index) => (
    <UncontrolledAlert key={/* eslint-disable-line react/no-array-index-key */ index} color={color} {...props}>
      {message}
    </UncontrolledAlert>
  ));

const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);

  const addAlert = useCallback((color, message) => setAlerts((oldAlerts) => [...oldAlerts, { color, message }]), []);

  return { addAlert, alerts };
};

export default useAlerts;
