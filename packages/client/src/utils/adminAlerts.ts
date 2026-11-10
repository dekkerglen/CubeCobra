// ML retraining runs that need an admin (awaiting approval, or failed and not yet dismissed).
// render.ts adds this to reactProps for admins only; see serverutils/mlRetraining.
export interface AdminAlerts {
  count: number;
  ids: string[];
}

export const getAdminAlertCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const alerts = (window.reactProps as { adminAlerts?: AdminAlerts } | undefined)?.adminAlerts;
  return typeof alerts?.count === 'number' ? alerts.count : 0;
};
