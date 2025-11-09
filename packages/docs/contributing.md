# Contributing to CubeCobra

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help makes CubeCobra better for everyone.

## About CubeCobra

CubeCobra's main goal is to create the best cube management tool. We want to create a platform that is easy to use, while offering advanced features that allow users a high degree of freedom to organize and analyze their cube in a way that makes sense to them.

### Why Contribute?

- **Give back to the Magic community**: Help improve tools used by thousands of cube enthusiasts
- **Learn and grow**: Work with modern web technologies and contribute to open source
- **Fix what bothers you**: Whether it's a bug or missing feature, contributing is the best way to get it addressed
- **Join a welcoming community**: We welcome developers of all skill levels and will help you succeed

## Code of Conduct

Be a decent person. We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Characteristics of an Ideal Contributor

- Creates issues for changes and enhancements they wish to make
- Discusses proposed changes transparently and listens to community feedback
- Keeps pull requests small and focused
- Is welcoming to newcomers and encourages diverse contributors from all backgrounds

**Note**: Contributing to CubeCobra does not entitle any contributor to compensation. Contributions are made voluntarily to improve the tool for the entire community.

## Getting Started

### 1. Join the Community

- **[Discord](https://discord.gg/YYF9x65Ane)**: Join our community for real-time discussion and support
- **Contributor Role**: Message @Dekkaru on Discord to get the contributor role and access development channels
- **GitHub**: Star and watch the repository for code updates

Our developers are happy to help get new folks started with the project - don't hesitate to ask questions!

### 2. Set Up Development Environment

Choose your preferred setup method:
- **[Docker Setup](./setup/docker-setup.md)** (Recommended)
- **[Node.js Setup](./setup/nodejs-setup.md)** (Alternative)

### 3. Find Your First Contribution

- Browse the **Discord development channels** for current needs and priorities
- Ask in Discord about **beginner-friendly tasks** to get started
- Look for **documentation improvements** or **small bug fixes** as first contributions
- Check with @Dekkaru or other developers about **current focus areas**

## Development Workflow

### 1. Planning Your Work

**Before starting significant work:**

1. **Check Discord development channels**: Look for related discussions or ongoing work
2. **Discuss your idea**: Describe what you plan to work on in Discord
3. **Get feedback**: Discuss your approach with maintainers and community
4. **Coordinate the work**: Make sure others know what you're working on to avoid duplication

### 2. Making Changes

1. **Fork the repository** and create a feature branch
2. **Make your changes** following our coding standards
3. **Test thoroughly** to ensure you haven't broken existing functionality
4. **Write tests** for new features or bug fixes
5. **Update documentation** if needed

### 3. Submitting Changes

1. **Create a pull request** with a clear title and description
2. **Reference related discussions** from Discord if applicable
3. **Request review** when your code is ready
4. **Respond to feedback** and make requested changes
5. **Celebrate** when your PR is merged! 🎉

## Coding Standards

### Code Style

CubeCobra uses automated code formatting and linting:

```bash
# Check formatting and linting
npm run lint

# Auto-fix issues (when possible)
npx prettier --write .
npx eslint --fix .
```

### Languages and Tools

- **TypeScript**: Gradually replacing JavaScript throughout the codebase
- **React**: Frontend components with hooks and functional patterns
- **Express**: Backend API and server-side rendering
- **TailwindCSS**: Utility-first CSS framework
- **Jest**: Testing framework

### Testing

- **Write tests** for new functionality and bug fixes
- **Run tests** before submitting PRs: `npm test`
- **Maintain coverage** and add tests for edge cases
- **Update existing tests** when changing behavior

## Communication and Collaboration

We use a combination of Discord for real-time collaboration and GitHub for code management. Our contributors work on their own schedules, so we balance synchronous Discord discussions with asynchronous development work.

### Discord as Primary Communication

- **Development Channels**: Main hub for bug reports, feature requests, and project coordination
- **Real-time Discussion**: Quick questions, brainstorming, and community interaction
- **Project Updates**: Announcements about releases, priorities, and important changes
- **Getting Help**: New contributor onboarding and development support

### GitHub for Code Management

- **Pull Requests**: Track work in progress and completed changes
- **Code Review**: Detailed feedback on implementation and quality
- **Release Management**: Branching strategy and deployment coordination
- **Documentation**: Project documentation and technical guides

### How We Use Discord

Discord is our primary platform for project coordination and community interaction:

- **Bug Reports**: Report issues in development channels with details and reproduction steps
- **Feature Requests**: Discuss new ideas and get community feedback
- **Work Coordination**: Let others know what you're working on
- **Code Discussion**: Get quick feedback on approaches and implementations
- **Community Building**: Get to know other contributors and users
- **Release Coordination**: Discuss timing and priorities for releases

**Important**: While Discord is great for discussion, make sure to document important decisions in your pull requests or project documentation.

### How We Use Pull Requests

- **Open early**: Use `[WIP]` for work-in-progress PRs to show your progress
- **Describe changes**: Explain what you changed and why in the PR description
- **Reference Discord discussions**: Mention relevant conversations from Discord
- **Request specific reviewers**: Tag people you'd like feedback from
- **Respond to reviews**: Address feedback promptly and professionally

### Git Branch Strategy

- **`master` branch**: Latest development code, pending next release
- **Release branches**: Forked from master for production deployments
- **Feature branches**: Create from master for your changes
- **Naming convention**: Use descriptive names like `fix/card-search-bug` or `feature/new-draft-format`

### How We Use Discord

Discord is our main communication hub and serves multiple purposes:

- **Project Coordination**: Discuss current priorities and coordinate work
- **Bug Reports and Feature Requests**: Report issues and suggest improvements
- **Real-time Help**: Get quick answers to development questions
- **Community Interaction**: Learn about user needs and priorities
- **Release Planning**: Coordinate urgent issues and release timing
- **Social Connection**: Get to know the community and maintainers

**Getting Access**: Message @Dekkaru to get the contributor role and access development channels.

**Important**: While Discord drives our collaboration, important technical decisions and documentation should be preserved in GitHub PRs and project documentation.

## Types of Contributions

### Code Contributions

- **Bug fixes**: Fix reported issues and edge cases
- **New features**: Implement requested functionality
- **Performance improvements**: Optimize slow operations
- **Refactoring**: Improve code quality and maintainability
- **Security fixes**: Address vulnerabilities (report privately first)

### Non-Code Contributions

- **Documentation**: Improve guides, tutorials, and API docs
- **Testing**: Write tests, report bugs, test new features
- **Design**: UI/UX improvements and accessibility enhancements
- **Community**: Help other contributors, answer questions
- **Translation**: Internationalization support (future)

### Areas Needing Help

Current priorities include:

- **TypeScript migration**: Converting JavaScript files to TypeScript
- **Test coverage**: Adding tests for untested functionality
- **Performance**: Optimizing slow queries and large data handling
- **Accessibility**: Making the site more accessible
- **Mobile experience**: Improving mobile responsiveness
- **Documentation**: Keeping docs up-to-date with code changes

## Reporting Issues

### Bug Reports

Report bugs in the **Discord development channels** with:

- **Clear description**: Summarize the problem clearly
- **Steps to reproduce**: Detailed steps to recreate the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Browser, OS, device type
- **Screenshots**: If helpful for UI issues

### Security Vulnerabilities

**Do NOT report security vulnerabilities in public Discord channels.**

Instead:
- Message `@Dekkaru` privately on Discord
- Email `support@cubecobra.com`
- Provide details privately so we can fix before disclosure

### Feature Requests

- **Check Discord history**: Someone might have already suggested it
- **Post in development channels**: Share your idea and get community feedback
- **Provide context**: Explain the problem you're trying to solve
- **Be open to discussion**: Be willing to refine the idea based on feedback

## Development Resources

### Getting Help

- **[Discord](https://discord.gg/YYF9x65Ane)**: Real-time help from community and maintainers (message @Dekkaru for contributor role)
- **[Setup Troubleshooting](./setup-troubleshooting.md)**: Common setup issues and solutions
- **[Development Tools](./dev-tools.md)**: Recommended development environment
- **Pull Request Discussions**: Technical questions about specific code changes

### Documentation

- **[Architecture Overview](./README.md)**: Complete documentation index
- **[Nearley Parser](./nearley.md)**: Card filter grammar and parsing
- **[Testing Guide](./testing.md)**: Running and writing tests
- **[Parser Documentation](./parser.md)**: Card filtering system

### External Resources

- **[Development Server](http://cubecobradev.com/)**: Test your changes in a production-like environment
- **[Community Feedback](https://www.notion.so/CubeCobra-community-feedback-142b06cd81994a61bd850fb5bc817cc8)**: Community ideas and roadmap (ask for access on Discord)
- **Discord Archives**: Search Discord history for previous discussions on similar topics

## Code Review Process

### Automated Checks

All pull requests run automated checks:
- **Linting**: ESLint for code quality
- **Formatting**: Prettier for consistent style
- **Tests**: Jest test suite
- **Build**: Ensure the application builds successfully

Make sure these pass before requesting review.

### Human Review

We review code for:
- **Functionality**: Does it work as intended?
- **Testing**: Are there adequate tests?
- **Performance**: Will it scale appropriately?
- **Security**: Are there any security concerns?
- **Style**: Does it follow our coding standards?
- **Documentation**: Is it clear what the code does?

### Review Guidelines

**For reviewers:**
- Be constructive and helpful in feedback
- Explain the reasoning behind suggestions
- Link to relevant documentation or examples
- Approve when satisfied, even if minor improvements could be made

**For authors:**
- Respond to feedback promptly and professionally
- Ask questions if feedback is unclear
- Make requested changes or explain why you disagree
- Thank reviewers for their time

## Release Process

### Development Flow

1. **Development**: Changes merged to `master` branch
2. **Testing**: Features tested on development server
3. **Release Branch**: Created from `master` for production
4. **Deployment**: Release branch deployed to production
5. **Monitoring**: Watch for issues and hotfixes if needed

### Contributing to Releases

- **Test on dev server**: Help test new features before release
- **Report issues**: Share bugs found during testing in Discord
- **Help with hotfixes**: Critical bugs may need immediate fixes

## Recognition

We value all contributions and recognize them in several ways:

- **Contributor role**: Special Discord role for active contributors
- **GitHub mentions**: Credit in release notes and changelogs
- **Community recognition**: Shoutouts in Discord and community updates

## Questions?

- **Development questions**: Ask in Discord development channels
- **Contribution ideas**: Discuss in Discord or create a pull request
- **General support**: Contact maintainers on Discord (@Dekkaru)

Remember, our development team is friendly and welcoming - we're always happy to help new contributors get started with the project!

Thank you for contributing to CubeCobra! 🎲✨
