import React, { useEffect, useState } from 'react';

const ClientOnly = ({ children }) => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient && <>{children}</>;
}

export default ClientOnly;