const express = require('express');

const Cube = require('../dynamo/models/cube');
const CubeHash = require('../dynamo/models/cubeHash');
const Draft = require('../dynamo/models/draft');
const Content = require('../dynamo/models/content');
const Feed = require('../dynamo/models/feed');
const { getDailyP1P1 } = require('../util/dailyP1P1');

import { ContentStatus, ContentType } from '../datatypes/Content';

const { handleRouteError, render, redirect } = require('../util/render');
const { csrfProtection, ensureAuth } = require('./middleware');
const { isCubeListed } = require('../util/cubefn');

const router = express.Router();

router.use(csrfProtection);

// Home route
router.get('/', async (req, res) => (req.user ? redirect(req, res, '/dashboard') : redirect(req, res, '/landing')));

router.get('/explore', async (req, res) => {
  const recents = (await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC)).items.filter((cube) =>
    isCubeListed(cube, req.user),
  );

  const { getFeaturedCubes } = require('../util/featuredQueue');
  const featured = await getFeaturedCubes();

  const popularHashes = await CubeHash.getSortedByFollowers(`featured:false`, false);
  const popular = await Cube.batchGet(popularHashes.items.map((hash) => hash.cube));

  const recentDecks = await Draft.queryByTypeAndDate(Draft.TYPES.DRAFT);
  const recentlyDrafted = await Cube.batchGet(recentDecks.items.map((deck) => deck.cube));

  return render(req, res, 'ExplorePage', {
    recents: recents.sort((a, b) => b.date - a.date).slice(0, 12),
    featured,
    drafted: recentlyDrafted.sort((a, b) => b.date - a.date).slice(0, 12),
    popular: popular.sort((a, b) => b.following.length - a.following.length).slice(0, 12),
  });
});

router.get('/queue', async (req, res) => {
  const FeaturedQueue = require('../dynamo/models/featuredQueue');

  let featured = [];
  let lastkey = null;

  do {
    const response = await FeaturedQueue.querySortedByDate(lastkey);
    featured = featured.concat(response.items);
    lastkey = response.lastKey;
  } while (lastkey);

  const cubes = await Cube.batchGet(featured.map((f) => f.cube));
  const sortedCubes = featured.map((f) => cubes.find((c) => c.id === f.cube)).filter((c) => c);

  return render(req, res, 'FeaturedQueuePage', {
    cubes: sortedCubes,
  });
});

router.get('/dashboard', ensureAuth, async (req, res) => {
  try {
    const posts = await Feed.getByTo(req.user.id);

    const { getFeaturedCubes } = require('../util/featuredQueue');
    const featured = await getFeaturedCubes();

    const content = await Content.getByStatus(ContentStatus.PUBLISHED);

    const decks = await Draft.getByCubeOwner(req.user.id);

    // Get daily P1P1
    const dailyP1P1 = await getDailyP1P1(req.logger);

    return render(req, res, 'DashboardPage', {
      posts: posts.items.map((item) => item.document),
      lastKey: posts.lastKey,
      decks: decks.items,
      lastDeckKey: decks.lastEvaluatedKey,
      content: content.items.filter((item) => item.type !== ContentType.PODCAST),
      featured,
      dailyP1P1,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/landing');
  }
});

router.post('/getmorefeeditems', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;
  const { user } = req;

  const result = await Feed.getByTo(user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items.map((item) => item.document),
    lastKey: result.lastKey,
  });
});

router.post('/getmoredecks', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;

  const result = await Draft.getByCubeOwner(req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items,
    lastKey: result.lastEvaluatedKey,
  });
});

router.get('/landing', async (req, res) => {
  const { getFeaturedCubes } = require('../util/featuredQueue');
  const featured = await getFeaturedCubes();

  const content = await Content.getByStatus(ContentStatus.PUBLISHED);

  const recentDecks = await Draft.queryByTypeAndDate(Draft.TYPES.DRAFT);

  // Get daily P1P1
  const dailyP1P1 = await getDailyP1P1(req.logger);

  return render(req, res, 'LandingPage', {
    featured,
    content: content.items.filter((item) => item.type !== ContentType.PODCAST),
    recentDecks: recentDecks.items.filter((deck) => deck.complete),
    dailyP1P1,
  });
});

router.get('/version', async (req, res) => {
  return render(req, res, 'VersionPage', {
    version: process.env.CUBECOBRA_VERSION,
    host: process.env.DOMAIN,
    gitCommit: process.env.GIT_COMMIT,
  });
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
        text: 'This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data. Our Privacy Policy for Cube Cobra is created with the help of the Free Privacy Policy Generator. We use your data to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this policy. Unless otherwise defined in this Privacy Policy, terms used in this Privacy Policy have the same meanings as in our Terms and Conditions, accessible from cubecobra.com/tos',
      },
      {
        label: 'Information Collection And Use',
        text: 'We collect several different types of information for various purposes to provide and improve our Service to you.',
      },
      {
        label: 'Types of Data Collected',
        text: 'Personal Data: While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). Personally identifiable information may include, but is not limited to: email address, Cookies and Usage Data',
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
      {
        label: `For California Residents: CCPA Information`,
        text: `The remainder of the policy is specifically for California Residents`,
      },
      {
        label: '',
        text: 'This Privacy Notice for California Residents supplements the information contained elsewhere in this Privacy Notice and applies solely to all visitors, users, and others who reside in the State of California (“consumers” or “you”). We adopt this notice to comply with the California Consumer Privacy Act of 2018 (CCPA) and any terms defined in the CCPA have the same meaning when used in this notice.',
      },
      {
        label: `Rights and Choices`,
        text: `The CCPA provides consumers located in the state of California with certain rights regarding their personal information and data. The following section describes those rights and explains how to exercise them:`,
      },
      {
        label: `Access to Specific Information and Data Portability Rights`,
        text: `You have the right to request that the company disclose certain information to you about our collection and use of your personal information over the past 12 months. Once we receive and confirm your verifiable consumer request (as described in the section “Exercising Access, Data Portability, and Deletion Rights”), we will disclose to you:`,
      },
      {
        label: ``,
        text: `The categories of personal information we collected about you.`,
      },
      {
        label: ``,
        text: `The categories of sources for the personal information we collected about you.`,
      },
      {
        label: ``,
        text: `Our business or commercial purpose for collecting or selling that personal information.`,
      },
      {
        label: ``,
        text: `The categories of third parties with whom we share that personal information.`,
      },
      {
        label: ``,
        text: `The specific pieces of personal information we collected about you (also called data portability request)`,
      },
      {
        label: ``,
        text: `If we sold or disclose your personal information for a business purpose, two separate lists disclosing: Sales, identifying the personal information categories that each category of recipient purchased, and disclosures for a business purpose, identifying the personal information categories that each category of recipient obtained`,
      },
      {
        label: `Non-Discrimination`,
        text: `We will not discriminate against you for exercising any of your CCPA rights. Unless permitted by the CCPA, we will not:`,
      },
      {
        label: ``,
        text: `Deny you goods or services.`,
      },
      {
        label: ``,
        text: `Charge you different prices or rates for goods or services, including through granting discounts or imposing penalties.`,
      },
      {
        label: ``,
        text: `Provide you a different level or quality of goods or services.`,
      },
      {
        label: ``,
        text: `Suggest that you may receive a different price or rate for goods or services or a different level of quality of goods or services.`,
      },
      {
        label: ``,
        text: `Any CCPA-permitted financial incentive we offer will reasonably relate to your value and contain written terms that describe the program’s material aspects.`,
      },
      {
        label: `Exercising Access, Data Portability, and Deletion Rights`,
        text: `To exercise the access, data portability, and deletion rights described above, please submit a verifiable consumer request to us by emailing us at support@cubecobra.com`,
      },
      {
        label: ``,
        text: `Only you, or a person registered with the California Secretary of State that you authorize to act on your behalf, may make a verifiable consumer request related to your personal information. You may also make a verifiable consumer request on behalf of your minor child.`,
      },
      {
        label: ``,
        text: `You may only make a verifiable consumer request for access of data portability twice within a 12-month period. The verifiable consumer request must: Provide sufficient information that allows us to reasonably verify you are the person about whom we collected personal information or an authorized representative, and describe your request with sufficient detail that allows us to properly understand, evaluate, and respond to it.`,
      },
      {
        label: ``,
        text: `We cannot respond to your request or provide you with personal information if we cannot verify your identity or authority to make the request and confirm the personal information relates to you.`,
      },
      {
        label: ``,
        text: `Making a verifiable consumer request does not require you to create an account with us. We will only use personal information provided in a verifiable consumer request to verify the requestor’s identity or authority to make the request.`,
      },
      {
        label: `Information We Collect`,
        text: `Our websites, emails (with your consent, where required by law), and other products, services and platforms collect information that identifies, relates to, describes, references, is capable of being associated with, or could reasonably be linked, directly or indirectly, with a particular consumer or device (“personal information”). In particular, our websites, apps, emails, and other products, services and platforms may have collected the following categories of personal information from its consumers within the last twelve (12) months:`,
      },
      {
        table: [
          ['Category', 'Collected'],
          ['A. Identifiers', 'YES'],
          [
            'B. Personal information categories listed in the California Customer Records statute (Cal. Civ. Code § 1798.80(e))',
            'YES',
          ],
          ['C. Protected classification characteristics under California or federal law', 'NO'],
          ['D. Commercial information.', 'NO'],
          ['E. Biometric information.', 'NO'],
          ['F. Internet or other similar network activity.', 'YES'],
          ['G. Geolocation data.', 'NO'],
          ['H. Sensory data.', 'NO'],
          ['I. Professional or employment-related information.', 'NO'],
          ['J. Inferences drawn from other personal information.', 'NO'],
        ],
      },
      {
        label: `Personal information does not include:`,
        text: `Publicly available information from government records.`,
      },
      {
        label: ``,
        text: `Deidentified or aggregated consumer information.`,
      },
      {
        label: ``,
        text: `Information excluded from the CCPA’s scope, like:`,
      },
      {
        label: ``,
        text: `- health or medical information covered by the Health Insurance Portability and Accountability Act of 1996 (HIPAA) and the California Confidentiality of Medical Information Act (CMIA) or clinical trial data;`,
      },
      {
        label: ``,
        text: `- personal information covered by certain sector-specific privacy laws, including the Fair Credit Reporting Act (FRCA), the Gramm-Leach-Bliley Act (GLBA) or California Financial Information Privacy Act (FIPA), and the Driver’s Privacy.`,
      },
      {
        label: `Use of Personal Information`,
        text: `We may use or disclose the personal information we collect for one or more of the following business purposes:`,
      },
      {
        label: ``,
        text: `To fulfill or meet the reason you provided the information. For example, if you share your name and contact information to request a newsletter or ask a question about our products or services, we will use that personal information to respond to your inquiry. If you provide your personal information to purchase a product or service, we or our third-party service providers will use that information to process your payment and facilitate delivery. We may also save your information to facilitate new product or service orders and requests.`,
      },
      {
        label: ``,
        text: `To provide, support, personalize, and develop our websites, emails, and other products, services and platforms.`,
      },
      {
        label: ``,
        text: `To create, maintain, customize, and secure your account with us.`,
      },
      {
        label: ``,
        text: `To process your requests, purchases, transactions, and payments and prevent transactional fraud.`,
      },
      {
        label: ``,
        text: `To provide you with support and to respond to your inquiries, including investigating and addressing your concerns and monitoring and improving our responses.`,
      },
      {
        label: ``,
        text: `To personalize your website, apps, emails, or other product, service or platform experience and to deliver content and product and service offerings relevant to your interests, including targeted offers and ads through our websites, apps, emails, and other products, services and platforms.`,
      },
      {
        label: ``,
        text: `To help maintain the safety, security, and integrity of our websites, apps, emails, and other products, services and platforms, databases and other technology assets, and business.`,
      },
      {
        label: ``,
        text: `For testing, research, analysis, and product development, including to develop and improve our websites, apps, emails, and other products, services and platforms.`,
      },
      {
        label: ``,
        text: `To respond to law enforcement requests and as required by applicable law, court order, or governmental regulations.`,
      },
      {
        label: ``,
        text: `As described to you when collecting your personal information or as otherwise set forth in the CCPA.`,
      },
      {
        label: ``,
        text: `To evaluate or conduct a merger, divestiture, restructuring, reorganization, dissolution, or other sale or transfer of some or all of the Company’s assets, whether as a going concern or as part of bankruptcy, liquidation, or similar proceeding, in which personal information held by the Company about our Website users is among the assets transferred.`,
      },
      {
        label: ``,
        text: `The Company will not collect additional categories of personal information or use the personal information we collected for materially different, unrelated, or incompatible purposes without providing you notice.`,
      },
      {
        label: `Sharing Personal Information`,
        text: `The Company may disclose your personal information to a third-party for a business purpose or sell your personal information, subject to your right to opt-out of those sales (see ‘Sales of Personal Information’ below). When we disclose personal information for a business purpose, we enter a contract that describes the purpose and requires the recipient to both keep that personal information confidential and not use it for any purpose except performing the contract. The CCPA prohibits third parties who purchase the personal information we hold from reselling it unless you have received explicit notice and an opportunity to opt-out of further sales (see ‘Sales of Personal Information’ below).`,
      },
      {
        label: ``,
        text: `We may share your personal information with the following categories of third parties:`,
      },
      {
        label: ``,
        text: `- Subsidiaries and affiliates.`,
      },
      {
        label: ``,
        text: `- Contractors and service providers.`,
      },
      {
        label: ``,
        text: `- Data aggregators.`,
      },
      {
        label: ``,
        text: `- Third parties with whom we partner to offer products and services to you.`,
      },
      {
        label: `Disclosures of Personal Information for a Business Purpose`,
        text: `In the preceding twelve (12) months, the Company has disclosed none of the categories of personal information for a business purpose.`,
      },
      {
        label: `Sales of Personal Information`,
        text: `In the preceding twelve (12) months, the company has sold none of the categories of personal information collected through our ad-supported services.`,
      },
      {
        label: ``,
        text: `In the preceding twelve (12) months, the company has sold the following categories of personal information collected through our ad-supported services:`,
      },
      {
        label: ``,
        text: `- [Category A: Identifiers.]`,
      },
      {
        label: ``,
        text: `- [Category F: Internet or other similar network activity.]`,
      },
      {
        label: ``,
        text: `The company and our advertising partners collect the personal information identified above (such as the cookies stored on your browser, the advertising identifier on your mobile device, or the IP address of your device) when you visit our websites, apps, and other products, services and platforms, or open our emails. We, and our partners, use this information to tailor and deliver ads to you on our websites, apps, emails, and other products, services and platforms, or to help tailor ads to you when you visit others’ sites (or use others’ apps). To tailor ads that may be more relevant to you, we and/or our partners may share the information we collect with third parties.`,
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

router.get('/donate', (req, res) => {
  return render(req, res, 'DonatePage');
});

router.get('/c/:id', (req, res) => {
  redirect(req, res, `/cube/list/${req.params.id}`);
});

router.get('/d/:id', (req, res) => {
  redirect(req, res, `/draft/${req.params.id}`);
});

router.get('/leave', (req, res) => {
  return render(req, res, 'LeaveWarningPage', {
    url: req.query.url,
  });
});

router.get('/ads.txt', (req, res) => {
  redirect(req, res, 'https://api.nitropay.com/v1/ads-860.txt');
});

module.exports = router;
