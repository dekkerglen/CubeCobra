import https from 'https';

export const handler = async (event) => {
  const data = JSON.stringify({
    token: '7d113984-2aac-428c-ab06-ed91d6c1c726'
  });
  
  const options = {
    hostname: 'cubecobra.com',
    port: 443,
    path: '/job/featuredcubes/rotate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`);
  
    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });
  
  req.on('error', (error) => {
    console.error(error);
  });
  
  req.write(data);
  req.end();
};
