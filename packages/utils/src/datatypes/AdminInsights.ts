/**
 * Option lists for the admin Performance and Path Analysis tabs. The server builds its Insights
 * queries from these keys and the client shows the labels, so both read them from here.
 */

/** What the Performance tab can rank routes by. */
export const PERFORMANCE_METRICS = [
  { key: 'hits', label: 'Most hit routes', unit: 'requests' },
  { key: 'slowest_avg', label: 'Slowest routes (avg)', unit: 'ms avg' },
  { key: 'slowest_p95', label: 'Slowest routes (p95)', unit: 'ms p95' },
  { key: 'slowest_p99', label: 'Slowest routes (p99)', unit: 'ms p99' },
  { key: 'server_time', label: 'Most server time (sum of duration)', unit: 'ms total' },
  { key: 'egress', label: 'Most egress (sum of response bytes)', unit: 'bytes total' },
  { key: 'egress_avg', label: 'Largest responses (avg response bytes)', unit: 'bytes avg' },
  { key: 'ingress', label: 'Most ingress (sum of request bytes)', unit: 'bytes total' },
  { key: 'ingress_avg', label: 'Largest requests (avg request bytes)', unit: 'bytes avg' },
] as const;

export type PerformanceMetricKey = (typeof PERFORMANCE_METRICS)[number]['key'];

/** Fields the Path Analysis breakdown table can group a route's requests by. */
export const PATH_ANALYSIS_GROUPINGS = [
  { key: 'username', label: 'User' },
  { key: 'remoteAddr', label: 'IP address' },
  { key: 'status', label: 'Status code' },
  { key: 'method', label: 'Method' },
  { key: 'path', label: 'Exact URL' },
] as const;

export type PathAnalysisGroupKey = (typeof PATH_ANALYSIS_GROUPINGS)[number]['key'];
