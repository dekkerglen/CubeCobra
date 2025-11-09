# CubeCobra

An open source web application for building, managing, and playtesting Magic: the Gathering cubes.

## About

CubeCobra is a modern web platform that enables Magic: The Gathering players to:

- **Build and Manage Cubes**: Create custom draft environments with powerful card search and organization tools
- **Draft and Playtest**: Experience your cube through online drafting with AI opponents and real players
- **Analyze and Optimize**: Use analytics to understand your cube's balance and make data-driven improvements
- **Share and Discover**: Explore thousands of community cubes and share your own creations

## Features

### Cube Management
- Advanced card search with filters and syntax
- Visual cube layout and organization
- Version control and change tracking
- Import/export support for various formats

### Drafting Experience  
- Solo drafting with intelligent AI bots
- Multiplayer drafting with friends
- Various draft formats (8-person, Grid, Custom, etc.)
- Draft analysis and statistics

### Analytics & Insights
- Card popularity and pick order statistics
- Cube balance analysis
- Power level assessments
- Meta trend tracking

### Community Features
- Public cube browser with search and filtering
- User profiles and cube collections
- Feed and comments system
- Featured cube rotations

## Technology Stack

### Backend
- **Node.js** with Express 4 framework
- **DynamoDB** for data persistence
- **S3** for file storage and static assets
- **TypeScript** for type safety

### Frontend
- **React** with TypeScript
- **TailwindCSS** for styling
- **Webpack** for bundling

### Infrastructure
- **AWS** for production deployment
- **LocalStack** for local development
- **Docker** for containerization
- **CDK** for infrastructure as code

### Development Tools
- **ESLint** and **Prettier** for code quality
- **Jest** for testing
- **GitHub Actions** for CI/CD
- **Nearley** for card filter parsing

## Getting Started

Choose your preferred setup method:

### 🐳 Docker Setup (Recommended)
The fastest way to get CubeCobra running locally with all dependencies containerized.

**[→ Docker Setup Guide](./packages/docs/setup/docker-setup.md)**

### 🔧 Node.js Setup  
Alternative setup for developers who prefer working directly with Node.js.

**[→ Node.js Setup Guide](./packages/docs/setup/nodejs-setup.md)**

### 📋 Prerequisites
Before starting either setup, review the required tools and accounts.

**[→ Prerequisites Guide](./packages/docs/setup/prerequisites.md)**

## Documentation

Comprehensive documentation is available in the `/packages/docs` directory:

- **[📚 Complete Documentation](./packages/docs/README.md)** - Full documentation index
- **[🛠️ Development Tools](./packages/docs/dev-tools.md)** - IDE setup and development workflow  
- **[🧪 Testing Guide](./packages/docs/testing.md)** - Running and writing tests
- **[🔧 Troubleshooting](./packages/docs/setup-troubleshooting.md)** - Common issues and solutions

### Architecture & Concepts
- **[Card Filters](./packages/docs/parser.md)** - How card filtering and search works
- **[Nearley Parser](./packages/docs/nearley.md)** - Grammar files and parser generation
- **[Markdown Support](./packages/docs/markdown.md)** - Available markdown features
- **[Card Printing](./packages/docs/card-print-decision-making.md)** - Print decision logic

### Configuration & Maintenance
- **[Environment Variables](./packages/docs/setup/environment-variables.md)** - Complete configuration reference
- **[Card Definitions](./packages/docs/maintenance/card-definitions.md)** - Card data management and structure
- **[Updating Cards](./packages/docs/maintenance/updating-cards.md)** - Card data maintenance
- **[Analytics System](./packages/docs/maintenance/analytics.md)** - Analytics and exports
- **[Scheduled Jobs](./packages/docs/maintenance/scheduled-jobs.md)** - Automated maintenance

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help makes CubeCobra better for everyone.

**[→ Complete Contributing Guide](./packages/docs/contributing.md)**

### Quick Start for Contributors

1. **[Join our Discord](https://discord.gg/YYF9x65Ane)** - Get help and connect with the community
2. **Request contributor role** - Message @Dekkaru in Discord to gain access to development channels
3. **[Set up your environment](./packages/docs/setup/docker-setup.md)** - Follow our setup guides  
4. **Download data files** - Run `npm run download-data-files` for first-time setup
5. **Find something to work on** - Check Discord development channels for current needs
6. **Make your changes** - Follow our coding standards and write tests
7. **Submit a pull request** - We'll review and help you get it merged!

Our developers are happy to help get new folks started with the project - don't hesitate to ask questions in Discord!

### Development Workflow
1. Set up your development environment using our guides
2. Create a feature branch for your changes  
3. Follow our coding standards (ESLint + Prettier)
4. Write tests for new functionality
5. Submit a pull request with a clear description

### Areas for Contribution
- **Frontend Development**: React components and user interfaces
- **Backend Development**: API endpoints and data processing
- **Analytics**: Card analysis and cube insights
- **Testing**: Unit tests and integration tests
- **Documentation**: Guides, tutorials, and API docs
- **Infrastructure**: DevOps and deployment improvements

## Community

- **[Discord](https://discord.gg/YYF9x65Ane)**: Join our development community for real-time discussion and support
- **Bug Reports & Feature Requests**: All managed through Discord development channels
- **GitHub**: Used for code collaboration and pull requests

### Getting Help

- **New Contributors**: Join our [Discord](https://discord.gg/YYF9x65Ane) and message @Dekkaru for the contributor role to access development channels
- **Bug Reports**: Report issues in Discord development channels  
- **Feature Requests**: Discuss new ideas in Discord development channels
- **Development Support**: Get help with setup and development questions in Discord

Our development team is friendly and welcoming - we're always happy to help new contributors get started!

## License

CubeCobra is open source software licensed under the [ISC License](LICENSE).

---

*CubeCobra is not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC.*
