const express = require('express');

const util = require('../serverjs/util.js');

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const User = require('../models/user');
const Article = require('../models/article');
const Video = require('../models/video');
const PodcastEpisode = require('../models/podcastEpisode');

const carddb = require('../serverjs/cards');
const { makeFilter } = require('../serverjs/filterCubes');
const { render } = require('../serverjs/render');
const { csrfProtection } = require('./middleware');
const { getCubeId } = require('../serverjs/cubefn');

const router = express.Router();

router.use(csrfProtection);

const CUBE_PREVIEW_FIELDS =
  '_id urlAlias shortId image_uri image_name image_artist name owner owner_name type card_count overrideCategory categoryPrefixes categoryOverride';

// Home route
router.get('/', async (req, res) => (req.user ? res.redirect('/dashboard') : res.redirect('/landing')));

router.get('/explore', async (req, res) => {
  const userID = req.user ? req.user._id : '';

  const recentsq = Cube.find(
    {
      $or: [
        {
          card_count: {
            $gt: 200,
          },
          isListed: true,
        },
        {
          owner: userID,
        },
      ],
    },
    CUBE_PREVIEW_FIELDS,
  )
    .lean()
    .sort({
      date_updated: -1,
    })
    .limit(12)
    .exec();

  const featuredq = Cube.find(
    {
      isFeatured: true,
    },
    CUBE_PREVIEW_FIELDS,
  )
    .lean()
    .exec();

  const draftedq = Cube.find(
    {
      $or: [
        {
          isListed: true,
        },
        {
          owner: userID,
        },
      ],
    },
    CUBE_PREVIEW_FIELDS,
  )
    .lean()
    .sort({
      numDecks: -1,
    })
    .limit(12)
    .exec();

  const decksq = Deck.find()
    .lean()
    .sort({
      date: -1,
    })
    .limit(10)
    .exec();

  const [recents, featured, drafted, decks] = await Promise.all([recentsq, featuredq, draftedq, decksq]);

  const recentlyDrafted = await Cube.find({ _id: { $in: decks.map((deck) => deck.cube) } }, CUBE_PREVIEW_FIELDS).lean();

  return render(req, res, 'ExplorePage', {
    recents,
    featured,
    drafted,
    recentlyDrafted,
  });
});

router.get('/random', async (req, res) => {
  const count = await Cube.estimatedDocumentCount();
  const random = Math.floor(Math.random() * count);
  const cube = await Cube.findOne().skip(random).lean();
  res.redirect(`/cube/overview/${encodeURIComponent(getCubeId(cube))}`);
});

router.get('/dashboard', async (req, res) => {
  try {
    const { user } = req;
    if (!user) {
      return res.redirect('/landing');
    }

    const cubesq = Cube.find(
      {
        owner: user._id,
      },
      CUBE_PREVIEW_FIELDS,
    )
      .lean()
      .sort({
        date_updated: -1,
      });
    const postsq = Blog.find({
      $or: [
        {
          cube: {
            $in: user.followed_cubes,
          },
        },
        {
          owner: {
            $in: user.followed_users,
          },
        },
        {
          dev: 'true',
        },
      ],
    })
      .sort({
        date: -1,
      })
      .limit(10);

    const articlesq = Article.find({ status: 'published' }).sort({ date: -1 }).limit(10);
    const episodesq = PodcastEpisode.find().sort({ date: -1 }).limit(10);
    const videosq = Video.find({ status: 'published' }).sort({ date: -1 }).limit(10);

    // We can do these queries in parallel
    const [cubes, posts, articles, videos, episodes] = await Promise.all([
      cubesq,
      postsq,
      articlesq,
      videosq,
      episodesq,
    ]);

    const content = [];

    for (const article of articles) {
      content.push({
        type: 'article',
        date: article.date,
        content: article,
      });
    }
    for (const video of videos) {
      content.push({
        type: 'video',
        date: video.date,
        content: video,
      });
    }
    for (const episode of episodes) {
      content.push({
        type: 'episode',
        date: episode.date,
        content: episode,
      });
    }

    content.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    content.splice(10);

    const decks = await Deck.find({
      cubeOwner: user._id,
    })
      .sort({
        date: -1,
      })
      .lean()
      .limit(12);

    return render(req, res, 'DashboardPage', { posts, cubes, decks, content });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/landing');
  }
});

router.get('/dashboard/decks/:page', async (req, res) => {
  try {
    const pagesize = 30;
    const { page } = req.params;
    const { user } = req;
    if (!user) {
      return res.redirect('/landing');
    }

    const decks = await Deck.find({
      cubeOwner: user._id,
    })
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean()
      .exec();

    const numDecks = await Deck.countDocuments({
      cubeOwner: user._id,
    })
      .lean()
      .exec();

    return render(req, res, 'RecentDraftsPage', {
      decks,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(numDecks / pagesize),
      count: numDecks,
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send(err);
  }
});

router.get('/landing', async (req, res) => {
  const cubeq = Cube.estimatedDocumentCount().exec();
  const deckq = Deck.estimatedDocumentCount().exec();
  const userq = User.estimatedDocumentCount().exec();

  const [cube, deck, user] = await Promise.all([cubeq, deckq, userq]);

  return render(req, res, 'LandingPage', {
    numusers: user.toLocaleString('en-US'),
    numcubes: cube.toLocaleString('en-US'),
    numdrafts: deck.toLocaleString('en-US'),
    version: process.env.CUBECOBRA_VERSION,
  });
});

router.get('/version', async (req, res) => {
  return render(req, res, 'VersionPage', {
    version: process.env.CUBECOBRA_VERSION,
    host: process.env.HOST,
  });
});

router.get('/search', async (req, res) => {
  return render(req, res, 'SearchPage', {
    query: '',
    cubes: [],
  });
});

router.get('/search/:query/:page', async (req, res) => {
  try {
    const perPage = 36;
    const page = Math.max(0, req.params.page);

    const { order } = req.query;

    let sort = {
      date_updated: -1,
    };

    switch (order) {
      case 'pop':
        sort = {
          numDecks: -1,
        };
        break;
      case 'alpha':
        sort = {
          name: -1,
        };
        break;
      default:
        break;
    }

    let {
      filter: { query },
    } = await makeFilter(req.params.query, carddb);
    const listedQuery = { isListed: true };
    if (query.$and) {
      query.$and.push(listedQuery);
    } else {
      query = { $and: [{ isListed: true }, query] };
    }

    const count = await Cube.countDocuments(query);

    const cubes = await Cube.find(query, CUBE_PREVIEW_FIELDS)
      .lean()
      .sort(sort)
      .skip(perPage * page)
      .limit(perPage);

    return render(req, res, 'SearchPage', {
      query: req.params.query,
      cubes,
      count,
      perPage,
      page,
      order,
    });
  } catch (err) {
    req.logger.error(err);
    req.flash('danger', 'Invalid Search Syntax');

    return render(req, res, 'SearchPage', {
      query: req.params.query,
      cubes: [],
      count: 0,
      perPage: 0,
      page: 0,
    });
  }
});

router.get('/contact', (req, res) => {
  return render(req, res, 'ContactPage');
});

router.get('/tos', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Terms and Conditions',
    content: [
      {
        label: 'Introduction',
        text: `These Website Standard Terms and Conditions written on this webpage shall manage your use of our website, Cube Cobra accessible at cubecobra.com. These Terms will be applied fully and affect to your use of this Website. By using this Website, you agreed to accept all terms and conditions written in here. You must not use this Website if you disagree with any of these Website Standard Terms and Conditions. These Terms and Conditions have been generated with the help of the Terms And Conditions Template. People below 18 years old are not allowed to use this Website. All users who are minors must have the permission of, and be directly supervised by, their parent or guardian to use this site. If you are a minor, you must have your parent or guardian read and agree to these Terms of Use prior to you using this site.`,
      },
      {
        label: 'Intellectual Property Rights',
        text: `Other than the content you own, under these Terms, Cube Cobra and/or its licensors own all the intellectual property rights and materials contained in this Website. You are granted limited license only for purposes of viewing the material contained on this Website.`,
      },
      {
        label: 'Restrictions',
        text: `You are specifically restricted from all of the following:`,
      },
      {
        label: '',
        text: `selling, sublicensing and/or otherwise commercializing any Website material`,
      },
      {
        label: '',
        text: `using this Website in any way that is or may be damaging to this Website`,
      },
      {
        label: '',
        text: `using this Website in any way that impacts user access to this Website`,
      },
      {
        label: '',
        text: `using this Website contrary to applicable laws and regulations, or in any way may cause harm to the Website, or to any person or business entity`,
      },
      {
        label: '',
        text: `engaging in any data mining, data harvesting, data extracting or any other similar activity in relation to this Website`,
      },
      {
        label: '',
        text: `using this Website to engage in any advertising or marketing`,
      },
      {
        label: '',
        text: `Certain areas of this Website are restricted from being access by you and Cube Cobra may further restrict access by you to any areas of this Website, at any time, in absolute discretion. Any user ID and password you may have for this Website are confidential and you must maintain confidentiality as well.`,
      },
      {
        label: 'Your Content',
        text: `
        In these terms and conditions, "your user content" means material (including without limitation text, images, audio material, video material and audio-visual material) that you submit to this website, for whatever purpose. You grant to Cube Cobra a worldwide, irrevocable, non-exclusive, royalty-free license to use, reproduce, adapt, publish, translate and distribute your user content in any existing or future media. You also grant to Cube Cobra the right to sub-license these rights, and the right to bring an action for infringement of these rights. Your user content must not be illegal or unlawful, must not infringe any third party's legal rights, and must not be capable of giving rise to legal action whether against you or Cube Cobra or a third party (in each case under any applicable law). You must not submit any user content to the website that is or has ever been the subject of any threatened or actual legal proceedings or other similar complaint. Cube Cobra reserves the right to edit or remove any material submitted to this website, or stored on Cube Cobra's servers, or hosted or published upon this website. Notwithstanding Cube Cobra's rights under these terms and conditions in relation to user content, Cube Cobra does not undertake to monitor the submission of such content to, or the publication of such content on, this website.`,
      },
      {
        label: 'Your Privacy',
        text: `Please read the Privacy Policy: cubecobra.com/privacy`,
      },
      {
        label: 'No warranties',
        text: `This Website is provided "as is," with all faults, and Cube Cobra express no representations or warranties, of any kind related to this Website or the materials contained on this Website.Also, nothing contained on this Website shall be interpreted as advising you.`,
      },
      {
        label: 'Limitation of liability',
        text: `In no event shall Cube Cobra, nor any of its officers, directors and employees, shall be held liable for anything arising out of or in any way connected with your use of this Website whether such liability is under contract. Cube Cobra, including its officers, directors and employees shall not be held liable for any indirect, consequential or special liability arising out of or in any way related to your use of this Website.`,
      },
      {
        label: 'Reasonableness',
        text: `By using Cube Cobra, you agree that the exclusions and limitations of liability set out in this website disclaimer are reasonable. If you do not think they are reasonable, you must not use this website.`,
      },
      {
        label: 'Other Parties',
        text: `You accept that, as a limited liability entity, Cube Cobra has an interest in limiting the personal liability of its officers and employees. You agree that you will not bring any claim personally against Cube Cobra's officers or employees in respect of any losses you suffer in connection with the website. You agree that the limitations of warranties and liability set out in this website disclaimer will protect Cube Cobra's officers, employees, agents, subsidiaries, successors, assigns and sub-contractors as well as Cube Cobra.`,
      },
      {
        label: 'Indemnification',
        text: `You hereby indemnify to the fullest extent Cube Cobra from and against any and/or all liabilities, costs, demands, causes of action, damages and expenses arising in any way related to your breach of any of the provisions of these Terms.`,
      },
      {
        label: 'Severability',
        text: `If any provision of these Terms is found to be invalid under any applicable law, such provisions shall be deleted without affecting the remaining provisions herein.`,
      },
      {
        label: 'Variation of Terms',
        text: `Cube Cobra is permitted to revise these Terms at any time as it sees fit, and by using this Website you are expected to review these Terms on a regular basis.`,
      },
      {
        label: 'Assignment',
        text: `
        The Cube Cobra is allowed to assign, transfer, and subcontract its rights and/or obligations under these Terms without any notification. However, you are not allowed to assign, transfer, or subcontract any of your rights and/or obligations under these Terms.`,
      },
      {
        label: 'Entire Agreement',
        text: `These Terms constitute the entire agreement between Cube Cobra and you in relation to your use of this Website, and supersede all prior agreements and understandings.`,
      },
    ],
  });
});

router.get('/filters', (req, res) => {
  return render(req, res, 'FiltersPage');
});
router.get('/markdown', (req, res) => {
  return render(req, res, 'MarkdownPage');
});

router.get('/privacy', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Privacy Policy',
    content: [
      {
        label: 'Introduction',
        text: 'Effective date: June 22, 2019 ',
      },
      {
        label: '',
        text: 'Cube Cobra ("us", "we", or "our") operates the cubecobra.com website (the "Service").',
      },
      {
        label: '',
        text:
          'This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data. Our Privacy Policy for Cube Cobra is created with the help of the Free Privacy Policy Generator. We use your data to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this policy. Unless otherwise defined in this Privacy Policy, terms used in this Privacy Policy have the same meanings as in our Terms and Conditions, accessible from cubecobra.com/tos',
      },
      {
        label: 'Information Collection And Use',
        text:
          'We collect several different types of information for various purposes to provide and improve our Service to you.',
      },
      {
        label: 'Types of Data Collected',
        text:
          'Personal Data: While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). Personally identifiable information may include, but is not limited to: Email address, Cookies and Usage Data',
      },
      {
        label: '',
        text: `Usage Data: We may also collect information how the Service is accessed and used ("Usage Data"). This Usage Data may include information such as your computer's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers and other diagnostic data.`,
      },
      {
        label: '',
        text: `Tracking and Cookies Data: We use cookies and similar tracking technologies to track the activity on our Service and hold certain information.Cookies are files with small amount of data which may include an anonymous unique identifier. Cookies are sent to your browser from a website and stored on your device. Tracking technologies also used are beacons, tags, and scripts to collect and track information and to improve and analyze our Service. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.`,
      },
      {
        label: 'Example of Cookies we use:',
        text: `Session Cookies. We use Session Cookies to operate our Service.`,
      },
      {
        label: '',
        text: `Preference Cookies. We use Preference Cookies to remember your preferences and various settings.`,
      },
      {
        label: '',
        text: `Security Cookies. We use Security Cookies for security purposes.`,
      },
      {
        label: 'Use of Data',
        text: `Cube Cobra uses the collected data for various purposes:`,
      },
      {
        label: '',
        text: `To provide and maintain the Service`,
      },
      {
        label: '',
        text: `To notify you about changes to our Service`,
      },
      {
        label: '',
        text: `To allow you to participate in interactive features of our Service when you choose to do so`,
      },
      {
        label: '',
        text: `To provide customer care and support`,
      },
      {
        label: '',
        text: `To provide analysis or valuable information so that we can improve the Service`,
      },
      {
        label: '',
        text: `To monitor the usage of the Service`,
      },
      {
        label: '',
        text: `To detect, prevent and address technical issues`,
      },
      {
        label: 'Transfer Of Data',
        text: `Your information, including Personal Data, may be transferred to — and maintained on — computers located outside of your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from your jurisdiction. If you are located outside United States and choose to provide information to us, please note that we transfer the data, including Personal Data, to United States and process it there. Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer. Cube Cobra will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy and no transfer of your Personal Data will take place to an organization or a country unless there are adequate controls in place including the security of your data and other personal information.`,
      },
      {
        label: 'Disclosure Of Data',
        text: `Cube Cobra may disclose your Personal Data in the good faith belief that such action is necessary to:`,
      },
      {
        label: '',
        text: `To comply with a legal obligation`,
      },
      {
        label: '',
        text: `To protect and defend the rights or property of Cube Cobra`,
      },
      {
        label: '',
        text: `To prevent or investigate possible wrongdoing in connection with the Service`,
      },
      {
        label: '',
        text: `To protect the personal safety of users of the Service or the public`,
      },
      {
        label: '',
        text: `To protect against legal liability`,
      },
      {
        label: 'Security Of Data',
        text: `The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to usecommercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.`,
      },
      {
        label: 'Service Providers',
        text: `We may employ third party companies and individuals to facilitate our Service ("Service Providers"), to provide the Service on our behalf, to perform Service-relatedservices or to assist us in analyzing how our Service is used. These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.`,
      },
      {
        label: 'Links To Other Sites',
        text: `Our Service may contain links to other sites that are not operated by us. If you click on a third party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit. We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.`,
      },
      {
        label: "Children's Privacy",
        text: `Our Service does not address anyone under the age of 18 ("Children"). We do not knowingly collect personally identifiable information from anyone under the age of 18. If you are a parent or guardian and you are aware that your Children has provided us with Personal Data, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we take steps to remove that information from our servers.`,
      },
      {
        label: 'Changes To This Privacy Policy',
        text: `We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. We will let you know via email and/or a prominent notice on our Service, prior to the change becoming effective and update the "effective date" at the top of this Privacy Policy. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.y`,
      },
      {
        label: 'Contact Us',
        text: `We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.`,
      },
      {
        label: '',
        text: `By email: support@cubecobra.com`,
      },
    ],
  });
});

router.get('/cookies', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Cookies Policy',
    content: [
      {
        label: "Do we use 'cookies'?",
        text:
          "Yes. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser (if you allow)" +
          " that enables the site's or service provider's systems to recognize your browser and capture and remember certain information. For instance, we use" +
          ' cookies to maintan login sessions. They are also used to help us understand your preferences based on previous or' +
          ' current site activity, which enables us to provide you with improved services. We also use cookies to help us compile aggregate data about site traffic' +
          ' and site interaction so that we can offer better site experiences and tools in the future.',
      },
      {
        label: 'We use cookies to:',
        text:
          "Understand and save user's preferences for future visits, Compile aggregate data about site traffic and site interactions in order to offer better site" +
          ' experiences and tools in the future. We may also use trusted third' +
          ' party services that track this information on our behalf.' +
          ' You can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies. You do this through your browser (like Internet Explorer) settings.' +
          " Each browser is a little different, so look at your browser's Help menu to learn the correct way to modify your cookies.",
      },
      {
        label: 'If users disable cookies in their browser',
        text:
          'If you turn cookies off, some features will be disabled. It will turn off some of the features that make your site experience more efficient and some of our services will' +
          ' not function properly, including but not limited to Persistent Login.',
      },
    ],
  });
});

router.get('/ourstory', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Our Story',
    content: [
      {
        label: 'About the Creator',
        text:
          "My name is Gwen, and I'm the creator and Admin of Cube Cobra. Cube Cobra originated as my passion project. It started out with me being frustrated at not having tools that I enjoy for cube management, as cube design is a major hobby for me. I wanted a platform that had exactly the features that I cared about, and from talking to others in the cubing community, the current cube management tools left a lot to be desired. I launched Cube Cobra with my initial minimum feature set in June 2019, and since then I've been adding features. With my 1.3 update, I started sharing my project with the online cubing community and recieved a lot of positive encouragement and praise, which has further driven me to create a cube management tool for cube designers, by a fellow cube designer. I ended up open sourcing Cube Cobra, as I believe that is the best route for the quality and longevity of the project.",
      },
      {
        label: 'Project Goals',
        text:
          "The main goal of Cube Cobra is to create a cube management tool that doesn't need to be supplemented with any other tool such as excel, gatherer, or another cube management app. We want to create a platform that is easy to use, that still has advanced enough features that allow users a high degree of freedom to organize and analyze their cube in a way that makes sense to them. I want to create the best possible platform for users to build, playtest, and share their cube.",
      },
      {
        label: 'Moving Forward',
        text:
          "Cube Cobra is an ongoing collaborative effort. We have a ton of feature requests, and passionate developers working through to constantly improve the platform. We're have several large, long-term features that are in the pipeline, that we're very excited about. Make sure to follow us on Twitter, and/or Discord to stay up to date on all Cube Cobra updates.",
      },
    ],
  });
});

router.get('/faq', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Frequently Asked Questions',
    content: [
      {
        label: 'What does Cube Cobra provide that other tools do not?',
        text:
          'Cube Cobra offers the most tools catered specifically towards cube construction. The website is powered by Scryfall,' +
          ' which means that newly spoiled cards will be available to use up to 48 hours after being spoiled. The biggest advantage' +
          ' Cube Cobra has right now is a more modern and maintainable technology stack compared to other tools. This means Cube' +
          ' Cobra is updated frequently and is committed to adding features that the community asks for. ',
      },
      {
        label: 'What tech stack does Cube Cobra use?',
        text: 'Cube Cobra uses NodeJS with MongoDB for server side, and React front end with Bootstrap for CSS.',
      },
      {
        label: 'Is Cube Cobra Open Source?',
        text:
          "Yes! Given the goals of Cube Cobra, we've felt the best way to give the community the tool that they want is to make it a collaborative project. For the community, by the community. If you're interested in contributing, feel free to reach out and we will help you get started.",
      },
      {
        label: 'I am not a developer, can I still help improve Cube Cobra?',
        text:
          'Yes! Even if you are not a developer, you can still get involved in helping Cube Cobra become a better platform for everyone! If you want to be more involved in the community, join the Discord linked under Contact. You can submit bug reports, make feature requests, and talk to the developers directly there.',
      },
      {
        label: "I'm having trouble building my cube, where can I go for help?",
        text:
          'Head on over to our Discord! You can find the link under our contact page! We have an avid cubing community that would be more than happy to help you build your cube!',
      },
      {
        label: 'How can I put my lands into my guild sections?',
        text:
          'From your cube list page, click "Sort", set your primary sort to "Color Identity", and hit "Save as Default Sort". We highly recommend trying out different sorts, as they provide flexible and powerful ways to view your cube.',
      },
    ],
  });
});

router.get('/donate', (req, res) => {
  return render(req, res, 'DonatePage');
});

router.get('/c/:id', (req, res) => {
  res.redirect(`/cube/list/${req.params.id}`);
});

router.get('/leave', (req, res) => {
  return render(req, res, 'LeaveWarningPage', {
    url: req.query.url,
  });
});

module.exports = router;
