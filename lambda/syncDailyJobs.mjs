// import fetch from 'node-fetch';

export const handler = async () => {
  console.log('Sending requests to Cube Cobra for daily jobs.');

  const data = {
    token: '',
  };

  const jobs = [
    { name: 'podcast sync', url: 'https://cubecobra.com/job/podcasts/sync' },
    { name: 'daily P1P1 rotation', url: 'https://cubecobra.com/job/dailyp1p1/rotate' },
  ];

  const results = [];

  for (const job of jobs) {
    try {
      console.log(`Running ${job.name}...`);

      const response = await fetch(job.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      } else {
        const responseData = await response.text();
        console.log(`${job.name} completed:`, responseData);
        results.push({ job: job.name, status: 'success', response: responseData });
      }
    } catch (error) {
      console.error(`Error running ${job.name}:`, error);
      results.push({ job: job.name, status: 'error', error: error.message });
    }
  }

  console.log('Daily jobs completed:', results);
  return results;
};
