import { normalizeName } from '../../src/client/utils/cardutil';
import util from '../../src/util/util';

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
