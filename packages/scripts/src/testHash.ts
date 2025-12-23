import { Sha256 } from '@aws-crypto/sha256-js';

async function calculateHash(data: Record<string, string>): Promise<string> {
  data.ItemType = 'PACKAGE';

  const list = Object.entries(data)
    .map(([key, value]) => `${key}:${value}`)
    .sort();

  console.log('Sorted entries:', list);
  console.log('Joined string:', list.join(','));

  const hash = new Sha256();
  hash.update(list.join(','));
  const raw = await hash.digest();
  return Array.from(raw)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function test() {
  const oracleId = '17039058-822d-409f-938c-b727a366ba63';
  const hash = await calculateHash({ type: 'oracle', value: oracleId });
  console.log('\nOracle ID:', oracleId);
  console.log('Calculated hash:', hash);
  console.log('\nExpected hash from query: c808566b7d830b159a25bcffa7ffd6a12ff2ed01dc038fee77ccb6af2b67ed9c');
}

test().catch(console.error);
