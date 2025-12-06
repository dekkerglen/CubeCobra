import { render } from 'serverutils/render';
import { Request, Response } from '../../types/express';

const tosHandler = (req: Request, res: Response) => {
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
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [tosHandler],
  },
];
