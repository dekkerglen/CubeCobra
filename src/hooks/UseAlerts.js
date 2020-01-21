import React, { useCallback, useState } from 'react';

import { UncontrolledAlert } from 'reactstrap';

const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);

  const addAlert = useCallback((color, message) => setAlerts((alerts) => [...alerts, { color, message }]), []);

  const Alerts = useCallback(({ alerts, ...props }) => {
    return alerts.map(({ color, message }, index) => (
      <UncontrolledAlert key={index} color={color} {...props}>
        {message}
      </UncontrolledAlert>
    ));
  }, []);

  return { addAlert, alerts, Alerts };
};

export default useAlerts;
