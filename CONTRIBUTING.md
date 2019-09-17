# Introduction

### What is cube cobra?

The main goal with Cube Cobra is to create a cube management tool that doesn't need to be supplemented with any other tool such as excel, gatherer, or another cube management app. I want to create a platform that is easy to use, that still has advanced features that allow users a high degree of freedom to organize and analyze their cube in a way that makes sense to them. I want to create the best possible platform for users to build, playtest, and share their cube.

### Why contribute?

One of the best ways to create a sustainable software project is open source it. For cubecobra to become the best possible tool for cube managment it needs help from the community. By contributing to the project, you are giving back to the magic community. Maybe there's a lower priority feature you want to use or maybe there's just a bug that's been bothering you, either way contributing yourself is a great way to get it into the project. Open source software is often more reliable (more eyes on the code).


Don't feel nervous about making your first contribution, we accept developers with all levels of knowledge and will happily work with and help with whatever you need to make your first contribution. We are not code snobs, so don't be afraid to reach out with questions of any kind.

### What kind of contributions do we need?

The issues tab in github is kept up to date and tagged, but any contribution is appriciated from code comments to experimental features. Just keep in mind completing a feature does not guarantee it will be merged. If you want to complete a feature that you don't see in the backlog, communicate with dekkerglen to make sure you don't waste any effort.

# Ground Rules
### Code of conduct.

Be a decent person. Copy pasted from the linux code of conduct: In the interest of fostering an open and welcoming environment, we as contributors and maintainers pledge to making participation in our project and our community a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

> Responsibilities
> * Create issues for any major changes and enhancements that you wish to make. Discuss things transparently and get community feedback.
> * Keep features small. For large features consider splitting into multiple pull requests to get consistent feedback.
> * Be welcoming to newcomers and encourage diverse new contributors from all backgrounds. See the [Python Community Code of Conduct](https://www.python.org/psf/codeofconduct/).

Contributing to Cube Cobra does not entitle any contributor to compensation of any kind. Contributions are made at will, with the goal of improving the tool for the entire community. Cube Cobra's hosting costs are paid through donations and affiliate links. These funds are managed solely by Gwen Dekker, who is solely in charge of hosting and managing the live site.


# Your First Contribution

Issues are tagged with 'good first issue' if we think it's a good beginner task to tackle. Complete a few small changes to become familar with the codebase before diving into a huge feature.

# Getting started
### How to submit a contribution.

The master branch is the branch with changes that are pending for the next update. The release branches are forked from the master branch, and the latest release branch is the branch the server runs off of. First, assign yourself to an issue, and create a fork of the code. When you are finished with the feature, create a pull request back into the master branch. An admin will review your code and merge if it is accepted. Expect some comments and feedback.

### Code Style

Cube Cobra currently uses 4 languages: Javascript, Jade/PUG, CSS, and HTML. Please refer to the following guidelines with respect to each language.

#### Javascript

For Javascript please make sure your code is formatted using the JS Beautify standard. This can be done by running `npm run-script beautify`.

#### Jade/PUG CSS and HTML

For Jade/PUG, you can use the following atom package: https://atom.io/packages/jade-beautify
For HTML class names, please use all lower case name, with tokens separated by dashes (e.g. edit-blog-button). For HTML ID's, please use on alphabetic characters in camelcase.

### Development Server

The development server can be accessed at: http://162.243.163.51/
This server runs off the master branch, uses http instead of https, and has it's own database. The development server is a great way to test new features in an environment closer to the live server. Please report any bugs you see on the development server as an issue.

# Release Schedule

Releases are created every two weeks, on friday night. There is a feature freeze 3 days before the release where no 'feature-request' pull requests will be approved, only bugfixes. This is to prevent regression on the live server. 

# How to report a bug
### Security Disclosures

If you find a security vulnerability, do NOT open an issue. Send a private message to DEKKARU#2784 on discord instead. You can also email support@cubecobra.com.

### Tell your contributors how to file a bug report.

Create a new issue on github. Do not use the the github issue tracker for support help. Check out the discord channel instead. There is also a bug tracker discord channel if you would like to submit there first.

# How to suggest a feature or enhancement
### Join the discord disscussion.

 https://discord.gg/Hn39bCU

# Code review process

This will be a learning process for all involved. Expect some comments and discussion on code style and implementation.

# Community

We have a fairly active discord and would love for you to join the discussion.  https://discord.gg/Hn39bCU

Private Message 'DEKKARU', the admin on Discord, to gain the contributor role and unlock the contributor-only channels.

# Community feedback / product ideas

Feedback from the community is collected and synthesized into roadmap ideas in a shared document [here](https://www.notion.so/CubeCobra-community-feedback-142b06cd81994a61bd850fb5bc817cc8). To gain read/write access, PM 'DEKKARU' or 'emmett9001' on Discord.

### Commit Message Style

Please keep commit messages brief and informative.
### Labeling Conventions for new issues

Please apply either 'Bug' or 'Enhancement'. If the feature is small and easy, please add the 'Good First Issue' tag as well.
