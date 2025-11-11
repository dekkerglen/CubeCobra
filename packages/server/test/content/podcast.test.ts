import { ContentStatus, ContentType } from '../../src/datatypes/Content';
import Content from '../../src/dynamo/models/content';
import { updatePodcast } from '../../src/util/podcast';
import { getFeedData, getFeedEpisodes } from '../../src/util/rss';
import { createEpisode, createPodcast, createUser } from '../test-utils/data';

const mockSanitize = jest.fn((text) => text);

jest.mock('html-to-text', () => ({
  convert: jest.fn((text) => text),
}));

jest.mock('sanitize-html', () => {
  const module = jest.fn((text) => mockSanitize(text));
  //@ts-expect-error -- hh
  module.defaults = {
    allowedTags: ['span', 'div', 'p'],
  };
  return module;
});

jest.mock('../../src/util/rss');
jest.mock('../../src/dynamo/models/content');

describe('Podcast Utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
    // Reset sanitize mock to default behavior
    mockSanitize.mockImplementation((text) => text);
  });

  describe('updatePodcast', () => {
    it('should update podcast and episode images when feed image changes', async () => {
      const mockPodcast = createPodcast({
        image: 'old-image.jpg',
        id: 'podcast-1',
        owner: createUser({ id: 'user-1' }),
      });

      const mockEpisodes = [
        createEpisode({ podcast: 'podcast-1', image: 'old-image.jpg' }),
        createEpisode({ podcast: 'podcast-1', image: 'old-image.jpg' }),
      ];

      (getFeedData as jest.Mock).mockResolvedValue({
        image: 'new-image.jpg',
      });
      (getFeedEpisodes as jest.Mock).mockResolvedValue([]);
      (Content.getPodcastEpisodes as jest.Mock).mockResolvedValue(mockEpisodes);

      await updatePodcast(mockPodcast);

      expect(Content.batchPut).toHaveBeenCalledWith(
        mockEpisodes.map((episode) => ({
          ...episode,
          image: 'new-image.jpg',
        })),
      );
      expect(Content.update).toHaveBeenCalledWith({
        ...mockPodcast,
        image: 'new-image.jpg',
        date: expect.any(Number),
      });
    });

    it('should add new episodes from feed that do not exist', async () => {
      // Setup sanitize mock to strip HTML
      mockSanitize.mockImplementation((text) => text.replace(/<[^>]*>/g, ''));

      const mockPodcast = createPodcast({
        id: 'podcast-1',
        owner: createUser({ id: 'user-1' }),
        image: 'image.jpg',
        title: 'Test Podcast',
      });

      const mockFeedEpisodes = [
        {
          title: 'New Episode 1',
          description: '<span>Description 1</span>',
          date: '2025-08-22',
          guid: 'guid-1',
          link: 'http://example.com/1',
          source: 'http://example.com/1.mp3',
        },
        {
          title: 'New Episode 2',
          description: '<div>Description 2</div>',
          date: '2025-08-21',
          guid: 'guid-2',
          link: 'http://example.com/2',
          source: 'http://example.com/2.mp3',
        },
      ];

      (getFeedData as jest.Mock).mockResolvedValue({
        image: 'image.jpg',
      });
      (getFeedEpisodes as jest.Mock).mockResolvedValue(mockFeedEpisodes);
      (Content.getPodcastEpisodes as jest.Mock).mockResolvedValue([]);

      await updatePodcast(mockPodcast);

      expect(Content.put).toHaveBeenCalledTimes(2);
      expect(Content.put).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Episode 1',
          body: 'Description 1',
          podcastGuid: 'guid-1',
          status: ContentStatus.PUBLISHED,
        }),
        ContentType.EPISODE,
      );

      // Verify second episode was also sanitized
      expect(Content.put).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Episode 2',
          body: 'Description 2',
          podcastGuid: 'guid-2',
          status: ContentStatus.PUBLISHED,
        }),
        ContentType.EPISODE,
      );
    });

    it('should not add episodes that already exist', async () => {
      const mockPodcast = createPodcast({
        id: 'podcast-1',
        owner: createUser({ id: 'user-1' }),
      });

      const existingEpisode = createEpisode({
        podcast: 'podcast-1',
        podcastGuid: 'existing-guid',
      });

      const mockFeedEpisodes = [
        {
          title: 'Existing Episode',
          description: 'Description',
          date: '2025-08-22',
          guid: 'existing-guid',
          link: 'http://example.com/1',
          source: 'http://example.com/1.mp3',
        },
      ];

      (getFeedData as jest.Mock).mockResolvedValue({
        image: mockPodcast.image,
      });
      (getFeedEpisodes as jest.Mock).mockResolvedValue(mockFeedEpisodes);
      (Content.getPodcastEpisodes as jest.Mock).mockResolvedValue([existingEpisode]);

      await updatePodcast(mockPodcast);

      expect(Content.put).not.toHaveBeenCalled();
      expect(Content.update).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Number),
        }),
      );
    });

    it('should update episode images when feed image changes, even if podcast image matches', async () => {
      const mockPodcast = createPodcast({
        image: 'new-image.jpg', // Podcast already has new image
        id: 'podcast-1',
        owner: createUser({ id: 'user-1' }),
      });

      const mockEpisodes = [
        createEpisode({ podcast: 'podcast-1', image: 'old-image.jpg' }),
        createEpisode({ podcast: 'podcast-1', image: 'old-image.jpg' }),
      ];

      (getFeedData as jest.Mock).mockResolvedValue({
        image: 'new-image.jpg',
      });
      (getFeedEpisodes as jest.Mock).mockResolvedValue([]);
      (Content.getPodcastEpisodes as jest.Mock).mockResolvedValue(mockEpisodes);

      await updatePodcast(mockPodcast);

      // Should update episodes even though podcast image matches
      expect(Content.batchPut).toHaveBeenCalledWith(
        mockEpisodes.map((episode) => ({
          ...episode,
          image: 'new-image.jpg',
        })),
      );

      // Should not update podcast since image already matches
      expect(Content.update).toHaveBeenCalledWith({
        ...mockPodcast,
        date: expect.any(Number),
      });
    });

    it('should update both podcast and episode images when they differ from feed', async () => {
      const mockPodcast = createPodcast({
        image: 'old-image.jpg',
        id: 'podcast-1',
        owner: createUser({ id: 'user-1' }),
      });

      const mockEpisodes = [
        createEpisode({ podcast: 'podcast-1', image: 'different-image.jpg' }),
        createEpisode({ podcast: 'podcast-1', image: 'another-image.jpg' }),
      ];

      (getFeedData as jest.Mock).mockResolvedValue({
        image: 'new-image.jpg',
      });
      (getFeedEpisodes as jest.Mock).mockResolvedValue([]);
      (Content.getPodcastEpisodes as jest.Mock).mockResolvedValue(mockEpisodes);

      await updatePodcast(mockPodcast);

      expect(Content.batchPut).toHaveBeenCalledWith(
        mockEpisodes.map((episode) => ({
          ...episode,
          image: 'new-image.jpg',
        })),
      );

      expect(Content.update).toHaveBeenCalledWith({
        ...mockPodcast,
        image: 'new-image.jpg',
        date: expect.any(Number),
      });
    });
  });
});
