import { MAX_BYTES_PER_USER, MAX_IMAGES_PER_USER } from '@utils/hostedImagesUtil';
import { hostedImageDao } from 'dynamo/daos';
import { deleteStoredImage, processImage, storeImage } from 'serverutils/hostedImageStorage';

import { handler } from '../../../src/router/routes/user/images/upload';
import { createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('dynamo/daos', () => ({
  hostedImageDao: {
    getUsageForOwner: jest.fn(),
    createImage: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock('serverutils/hostedImageStorage', () => ({
  buildImageKey: jest.fn((owner: string, id: string) => `userimages/${owner}/${id}.webp`),
  processImage: jest.fn(),
  storeImage: jest.fn(async (key: string) => `/${key}`),
  deleteStoredImage: jest.fn(),
}));
jest.mock('serverutils/cloudwatch', () => ({ __esModule: true, default: { error: jest.fn() } }));

const mockDao = hostedImageDao as jest.Mocked<typeof hostedImageDao>;

const file = { data: Buffer.from('img'), size: 3, mimetype: 'image/png', name: 'a.png', truncated: false };

const upload = (user = createUser({ id: 'user-1' })) =>
  call(handler)
    .as(user)
    .withRequest({ files: { image: file } as any, body: {} })
    .send();

describe('hosted image upload quota', () => {
  beforeEach(() => {
    (processImage as jest.Mock).mockResolvedValue({ body: Buffer.from('out'), bytes: 1000, width: 10, height: 10 });
    mockDao.createImage.mockImplementation(async (partial: any) => ({
      ...partial,
      dateCreated: 1,
      dateLastUpdated: 1,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uploads when under quota', async () => {
    mockDao.getUsageForOwner.mockResolvedValue({ count: 3, bytes: 3000 });

    const res = await upload();

    expect(res.status).toBe(200);
    expect(mockDao.delete).not.toHaveBeenCalled();
  });

  it('serializes parallel uploads from one user so they cannot all pass the quota check', async () => {
    // Usage reflects every image recorded so far, like the real DAO.
    let stored = MAX_IMAGES_PER_USER - 1;
    mockDao.getUsageForOwner.mockImplementation(async (_owner: string, excludeId?: string) => ({
      count: excludeId ? stored - 1 : stored,
      bytes: 0,
    }));
    mockDao.createImage.mockImplementation(async (partial: any) => {
      stored += 1;
      return { ...partial, dateCreated: 1, dateLastUpdated: 1 };
    });

    const results = await Promise.all([upload(), upload(), upload(), upload()]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400, 400]);
    expect(stored).toBe(MAX_IMAGES_PER_USER);
    expect(mockDao.createImage).toHaveBeenCalledTimes(1);
  });

  it('rolls back an upload that went over quota because of a concurrent upload elsewhere', async () => {
    // First check sees room for one more; by the re-check another instance has used it.
    mockDao.getUsageForOwner
      .mockResolvedValueOnce({ count: MAX_IMAGES_PER_USER - 1, bytes: 0 })
      .mockResolvedValueOnce({ count: MAX_IMAGES_PER_USER, bytes: 0 });

    const res = await upload();

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`You have reached the maximum of ${MAX_IMAGES_PER_USER} hosted images.`);
    expect(storeImage).toHaveBeenCalledTimes(1);
    expect(mockDao.delete).toHaveBeenCalledTimes(1);
    expect(deleteStoredImage).toHaveBeenCalledWith((storeImage as jest.Mock).mock.calls[0][0]);
    // The re-check counts this upload explicitly instead of trusting the index to include it.
    expect(mockDao.getUsageForOwner).toHaveBeenLastCalledWith('user-1', mockDao.createImage.mock.calls[0]![0].id);
  });

  it('rolls back when the combined bytes go over the storage limit', async () => {
    mockDao.getUsageForOwner
      .mockResolvedValueOnce({ count: 1, bytes: MAX_BYTES_PER_USER - 1000 })
      .mockResolvedValueOnce({ count: 2, bytes: MAX_BYTES_PER_USER - 500 });

    const res = await upload();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/storage limit/);
    expect(mockDao.delete).toHaveBeenCalledTimes(1);
  });
});
