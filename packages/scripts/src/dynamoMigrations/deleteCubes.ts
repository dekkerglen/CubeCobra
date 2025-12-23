// Load Environment Variables
import { cubeDao } from '@server/dynamo/daos';

import 'dotenv/config';

// List of cube IDs to delete - FILL THIS OUT BEFORE RUNNING
const CUBE_IDS_TO_DELETE: string[] = [
  '14a9bafb-be01-4fe0-9aa7-44fa3d8bf66e',
  'c7bfc90b-3ecb-43a5-b591-624a898fda4a',
  '4158134a-b11c-49c3-b77f-2c575bcde120',
  '3fc8cae4-de35-485a-adfc-6a10411ab6a2',
  'ea0f60fa-0e69-4b18-8779-910feadc3319',
  '55800bea-0f39-4a29-b4aa-0b62b8942cc9',
  '06eb0c0a-53f9-4c00-952b-230f97ed4b0d',
  'b18cc4a6-49c7-4ae5-90d0-e4a6bd2e3411',
  '4ab7b751-2a2c-4ed1-b7c7-67a171a26cf9',
  '296b21f7-5ed8-462d-bb56-c4bfed20fed2',
  '15438bcc-7a49-4348-b601-deaebf43ffa0',
  'c8cdd0f8-dd64-4a6a-8945-d0f589479843',
  '50c85a61-58ea-4425-a440-2db9725f1e5f',
  '26653eab-46c4-4fe8-80c9-c5f6f62f55fb',
  'a040b61d-5ad3-476f-8055-dc98dec2db93',
  '1a41e9c6-fb82-4960-95be-e3e3bce8be6a',
  '8d037574-f208-49f5-a0ae-daaca38a5b5a',
  '461f4be6-3ec4-45c1-afdf-e5ced9b73e38',
  '2b5a8fe2-09c4-426e-a12d-7becffbadac7',
  'bf93010b-04db-4a9b-beaf-66007f2910ad',
  '2330864f-a855-4dc2-80b2-540831821616',
  'f970d4ad-e20a-42e5-9afa-4d5a80b05cfa',
  '145225b9-33fc-4fba-b03f-d7524ac499d0',
  '17ae0b97-c572-413b-8ee8-bf59ef4233db',
  'd705530f-38ff-433a-8213-4912672c5c96',
  'eb0ea8b5-87ba-4a30-a225-9af6180a316f',
  '5c2f9a1d-2b3d-43d0-bb17-d56b00cebe55',
  '5360203f-4945-4421-b4bd-2761c4f064eb',
  '47677755-d3ba-4b85-b685-1055bc8694e5',
  '655eed38-128e-4c2c-a9a1-46d86b8f14fe',
  'f7627f76-850c-44a5-ac11-68e0539c2d54',
  'c715ad37-3bea-4e26-a87b-dc4ea39e2de1',
  '6b488a9d-2acd-484c-b6e2-4d933cfdd803',
  'd8a2eb77-0631-4895-b099-63b43d05b68f',
  'f8cb0994-0d44-43ef-ad36-0b628420ef03',
  'a384c27b-5411-4303-9469-d30a7eef4121',
  '79cf891c-5d26-4658-924f-69d8d3e17ebe',
  '9f31cff9-96b0-4821-9310-d75a0d1a6f0b',
  'b2ca0e4a-7882-4e47-b712-0e2cbab62f42',
  '717ec90d-d2e8-446d-a111-b4bb4a53f709',
  'fceef7ee-857b-48d1-a582-746573cfc820',
  '8cd110bc-abb3-4b41-a605-1010537cd521',
  'b95d9216-9170-41b4-8b46-7757051aff64',
  'd5118b5e-8258-4f1a-94ea-8e8ac9aa82ea',
  '1ce32602-456e-457d-b1cd-b007da24e5aa',
  '43929255-90b3-4d4e-9430-354649186e14',
  '5d1888c9-486a-4f4f-89ac-b7bba6641802',
  '55b2139a-92fd-49ee-b575-0fae3ab5498a',
  'ae17aac2-7fd4-4458-9f02-a7c5cc47a668',
  '22aeb526-ca7c-4856-8b5b-2693761bd8ad',
  '8b3df008-ec26-4673-bb77-52e82709a748',
];

interface DeletionStats {
  total: number;
  deleted: number;
  errors: number;
  notFound: number;
}

/**
 * Script to delete cubes and their associated hash rows from DynamoDB.
 *
 * This script will:
 * 1. Delete the cube metadata from the main table
 * 2. Delete all hash rows associated with the cube
 * 3. NOT delete cards from S3 (cards remain for potential recovery)
 *
 * WARNING: This is a destructive operation. Make sure you have the correct cube IDs
 * before running this script.
 */
(async () => {
  try {
    console.log('Starting cube deletion process');
    console.log('='.repeat(80));

    if (CUBE_IDS_TO_DELETE.length === 0) {
      console.log('ERROR: No cube IDs specified in CUBE_IDS_TO_DELETE array');
      console.log('Please add cube IDs to the array before running this script');
      process.exit(1);
    }

    console.log(`Will attempt to delete ${CUBE_IDS_TO_DELETE.length} cube(s):`);
    CUBE_IDS_TO_DELETE.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    console.log();

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);
    console.log();

    const stats: DeletionStats = {
      total: CUBE_IDS_TO_DELETE.length,
      deleted: 0,
      errors: 0,
      notFound: 0,
    };

    // Process each cube
    for (const cubeId of CUBE_IDS_TO_DELETE) {
      try {
        console.log(`Processing cube: ${cubeId}`);

        // Check if cube exists
        const cube = await cubeDao.getById(cubeId);

        if (!cube) {
          console.log(`  ⚠ Cube not found: ${cubeId}`);
          stats.notFound += 1;
          continue;
        }

        console.log(`  Found cube: ${cube.name}`);
        console.log(`  Owner: ${typeof cube.owner === 'string' ? cube.owner : cube.owner.username}`);

        // Delete the cube (this also deletes hash rows)
        await cubeDao.deleteById(cubeId);

        console.log(`  ✓ Successfully deleted cube and hash rows`);
        stats.deleted += 1;
      } catch (error) {
        console.error(`  ✗ Error deleting cube ${cubeId}:`, error);
        stats.errors += 1;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Deletion complete!');
    console.log(`Total cubes processed: ${stats.total}`);
    console.log(`Successfully deleted: ${stats.deleted}`);
    console.log(`Not found: ${stats.notFound}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\nNote: Cards in S3 (cardlist/{id}.json) were NOT deleted and can be recovered if needed.');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Deletion failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
