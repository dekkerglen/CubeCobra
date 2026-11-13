import React, { useContext, useEffect, useState } from 'react';

import {
  SITE_ACTIVITY_LABELS,
  SITE_ACTIVITY_SECTIONS,
  SiteActivityBucket,
  SiteActivityGranularity,
  SiteActivityResponse,
} from '@utils/datatypes/SiteActivity';

import { colorForIndex, LineChart } from 'components/admin/AdminCharts';
import { AdminTabSpinner } from 'components/admin/AdminTabData';
import Alert from 'components/base/Alert';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

const GRANULARITY_OPTIONS: { value: SiteActivityGranularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

const RANGES: Record<SiteActivityGranularity, { options: { value: string; label: string }[]; initial: string }> = {
  day: {
    options: [
      { value: '7', label: 'Last 7 days' },
      { value: '30', label: 'Last 30 days' },
      { value: '90', label: 'Last 90 days' },
      { value: '365', label: 'Last 365 days' },
    ],
    initial: '30',
  },
  week: {
    options: [
      { value: '12', label: 'Last 12 weeks' },
      { value: '26', label: 'Last 26 weeks' },
      { value: '52', label: 'Last 52 weeks' },
      { value: '104', label: 'Last 104 weeks' },
    ],
    initial: '26',
  },
  month: {
    options: [
      { value: '6', label: 'Last 6 months' },
      { value: '12', label: 'Last 12 months' },
      { value: '24', label: 'Last 24 months' },
      { value: '60', label: 'Last 60 months' },
    ],
    initial: '12',
  },
  year: {
    options: [
      { value: '3', label: 'Last 3 years' },
      { value: '5', label: 'Last 5 years' },
      { value: '10', label: 'Last 10 years' },
    ],
    initial: '5',
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A period's axis label, read off its UTC start date rather than the viewer's clock. */
const formatPeriodLabel = (start: string, granularity: SiteActivityGranularity): string => {
  const [year, month, day] = start.split('-').map(Number);
  if (granularity === 'year') return `${year}`;
  if (granularity === 'month') return `${MONTHS[(month ?? 1) - 1]} ${year}`;
  return `${month}/${day}`;
};

const SiteActivityTab: React.FC = () => {
  const { callApi } = useContext(CSRFContext);
  const [granularity, setGranularity] = useState<SiteActivityGranularity>('day');
  const [range, setRange] = useState(RANGES.day.initial);
  // Kept with the granularity it was fetched for, so labels never describe another period's data.
  const [data, setData] = useState<{ granularity: SiteActivityGranularity; buckets: SiteActivityBucket[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const response = await callApi('/admin/siteactivity/stats', { granularity, periods: Number(range) });
        const json = (await response.json()) as SiteActivityResponse & { success: string; error?: string };
        if (cancelled) return;
        if (json.success === 'true') {
          setData({ granularity, buckets: json.buckets });
        } else {
          setError(json.error || 'Query failed');
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callApi, granularity, range]);

  const changeGranularity = (value: string) => {
    const next = value as SiteActivityGranularity;
    setGranularity(next);
    setRange(RANGES[next].initial);
  };

  const labels = data ? data.buckets.map((bucket) => formatPeriodLabel(bucket.start, data.granularity)) : [];

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
          <Text semibold xl>
            Site Activity
          </Text>
          <Flexbox direction="row" gap="2">
            <div className="w-32">
              <Select
                id="site-activity-granularity"
                options={GRANULARITY_OPTIONS}
                value={granularity}
                setValue={changeGranularity}
              />
            </div>
            <div className="w-44">
              <Select
                id="site-activity-range"
                options={RANGES[granularity].options}
                value={range}
                setValue={setRange}
              />
            </div>
          </Flexbox>
        </Flexbox>
      </CardHeader>
      <CardBody>
        {error && <Alert color="danger">{error}</Alert>}
        {data === null ? (
          !error && <AdminTabSpinner />
        ) : (
          <Flexbox direction="col" gap="4">
            {SITE_ACTIVITY_SECTIONS.map((section) => (
              <Flexbox key={section.title} direction="col" gap="2">
                <Text semibold lg>
                  {section.title}
                </Text>
                <Row xs={12} gutters={2}>
                  {section.metrics.map((metric, index) => {
                    const values = data.buckets.map((bucket) => bucket[metric]);
                    const total = values.reduce((sum, value) => sum + value, 0);
                    return (
                      <Col key={metric} xs={12} lg={6}>
                        <Flexbox direction="row" justify="between" alignItems="center">
                          <Text semibold>{SITE_ACTIVITY_LABELS[metric]}</Text>
                          <Text semibold>{total.toLocaleString()}</Text>
                        </Flexbox>
                        <LineChart
                          labels={labels}
                          datasets={[
                            { label: SITE_ACTIVITY_LABELS[metric], data: values, color: colorForIndex(index) },
                          ]}
                          height={220}
                        />
                      </Col>
                    );
                  })}
                </Row>
              </Flexbox>
            ))}
          </Flexbox>
        )}
      </CardBody>
    </Card>
  );
};

export default SiteActivityTab;
