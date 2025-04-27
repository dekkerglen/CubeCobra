import { normalizeName } from '../../src/client/utils/cardutil';
import util from '../../src/util/util';

// ...existing code...

describe('getSafeReferrer', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.DOMAIN = 'cubecobra.com';
    process.env.HTTP_ONLY = 'false';
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns null when no referrer header exists', () => {
    const req = {
      header: jest.fn().mockReturnValue(null),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBeNull();
    expect(req.header).toHaveBeenCalledWith('Referrer');
  });

  it('returns null for external domain referrer', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://example.com/some/path'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBeNull();
  });

  it('returns pathname for valid internal referrer', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://cubecobra.com/cube/view/123'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('handles non-root relative urls', () => {
    const req = {
      header: jest.fn().mockReturnValue('not-a-url'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBe('/not-a-url');
  });

  it('allows the www subdomain of the app', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://www.cubecobra.com/cube/view/123'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('ignores query parameters and hash', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://cubecobra.com/cube/view/123?sort=name#top'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('handles relative URLs correctly', () => {
    const req = {
      header: jest.fn().mockReturnValue('/cube/view/123'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBe('/cube/view/123');
  });

  it('handles path manipulation urls', () => {
    const req = {
      header: jest.fn().mockReturnValue('../cube/../blog/view/123'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBe('/blog/view/123');
  });

  it('returns null for different subdomain and relative paths', () => {
    const req = {
      header: jest.fn().mockReturnValue('https://example.com/../blog/view/123'),
    };

    const result = util.getSafeReferrer(req);
    expect(result).toBeNull();
  });
});

describe('turnToTree', () => {
  //Fix the seed for consistency in tests
  const SHUFFLE_SEED = '1742131471000';

  it('Empty list is empty tree', () => {
    const result = util.turnToTree([]);
    expect(result).toEqual({});
  });

  const deepCardNames = [
    'Serra Angel',
    'Serra Paladin',
    'Serra Advocate',
    'Serra Ascendant',
    'Serra Avenger',
    'Serra Bestiary',
    "Serra's Hymn",
  ];

  const deepTreeCases = [
    { descriptor: 'sorted', cardNames: deepCardNames },
    { descriptor: 'unsorted', cardNames: util.shuffle(deepCardNames, SHUFFLE_SEED) },
  ];

  it.each(deepTreeCases)('Deep tree of card names ($descriptor)', async ({ cardNames }) => {
    const normalizedNames = cardNames.map((name: string) => normalizeName(name));

    const expectedTree = {
      s: {
        e: {
          r: {
            r: {
              a: {
                ' ': {
                  a: {
                    n: {
                      g: {
                        e: {
                          l: {
                            $: {},
                          },
                        },
                      },
                    },
                    d: {
                      v: {
                        o: {
                          c: {
                            a: {
                              t: {
                                e: {
                                  $: {},
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    s: {
                      c: {
                        e: {
                          n: {
                            d: {
                              a: {
                                n: {
                                  t: {
                                    $: {},
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    v: {
                      e: {
                        n: {
                          g: {
                            e: {
                              r: {
                                $: {},
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  b: {
                    e: {
                      s: {
                        t: {
                          i: {
                            a: {
                              r: {
                                y: {
                                  $: {},
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  p: {
                    a: {
                      l: {
                        a: {
                          d: {
                            i: {
                              n: {
                                $: {},
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                "'": {
                  s: {
                    ' ': {
                      h: {
                        y: {
                          m: {
                            n: {
                              $: {},
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = util.turnToTree(normalizedNames);
    expect(result).toEqual(expectedTree);
  });

  const wideCardNames = ['Gravecrawler', 'Island Art Card', "Kykar, Wind's Fury", 'Mutilate', 'Vesuva'];

  const wideTreeCases = [
    { descriptor: 'sorted', cardNames: wideCardNames },
    { descriptor: 'unsorted', cardNames: util.shuffle(wideCardNames, SHUFFLE_SEED) },
  ];

  it.each(wideTreeCases)('Wide tree of card names ($descriptor)', async ({ cardNames }) => {
    const normalizedNames = cardNames.map((name: string) => normalizeName(name));

    const expectedTree = {
      g: {
        r: {
          a: {
            v: {
              e: {
                c: {
                  r: {
                    a: {
                      w: {
                        l: {
                          e: {
                            r: {
                              $: {},
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      i: {
        s: {
          l: {
            a: {
              n: {
                d: {
                  ' ': {
                    a: {
                      r: {
                        t: {
                          ' ': {
                            c: {
                              a: {
                                r: {
                                  d: {
                                    $: {},
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      k: {
        y: {
          k: {
            a: {
              r: {
                ',': {
                  ' ': {
                    w: {
                      i: {
                        n: {
                          d: {
                            "'": {
                              s: {
                                ' ': {
                                  f: {
                                    u: {
                                      r: {
                                        y: {
                                          $: {},
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      m: {
        u: {
          t: {
            i: {
              l: {
                a: {
                  t: {
                    e: {
                      $: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
      v: {
        e: {
          s: {
            u: {
              v: {
                a: {
                  $: {},
                },
              },
            },
          },
        },
      },
    };

    const result = util.turnToTree(normalizedNames);
    expect(result).toEqual(expectedTree);
  });
});
