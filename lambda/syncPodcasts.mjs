// import fetch from 'node-fetch';

export const handler = async () => {
  console.log('Sending request to Cube Cobra to sync podcasts.');

  const data = {
    token: '7d113984-2aac-428c-ab06-ed91d6c1c726',
  };

  try {
    const response = await fetch('https://cubecobra.com/job/podcasts/sync', {
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
      console.log(responseData);
    }
  } catch (error) {
    console.log('Error:');
    console.error(error);
  }
};
