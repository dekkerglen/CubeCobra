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

> Characteristics of an ideal contributor
> * Creates issues for changes and enhancements they wish to make.
> * Discusses proposed changes transparently and listens to community feedback.
> * Keeps pull requests small.
> * Is welcoming to newcomers and encourages diverse new contributors from all backgrounds. See the [Python Community Code of Conduct](https://www.python.org/psf/codeofconduct/).

Contributing to Cube Cobra does not entitle any contributor to compensation of any kind. Contributions are made at will, with the goal of improving the tool for the entire community. Cube Cobra's hosting costs are paid through donations and affiliate links. These funds are managed solely by Gwen Dekker, who is solely in charge of hosting and managing the live site.


# Your First Contribution

Issues are tagged with 'good first issue' if we think it's a good beginner task to tackle. Complete a few small changes to become familar with the codebase before diving into a huge feature.


# How we collaborate - asynchronous communication

Our community of contributors is large, and growing fast. We don't have regularly
scheduled working hours dedicated to Cube Cobra. Thus, we can't simply message each
other on Discord to understand the current state of the project. Discord is
a great tool for synchronous communication, but it falls short at allowing
community members to discover conversations they didn't participate in. Our project
also requires a focus on asynchronous methods of communication. The goal is for
the current state of the project, including features being worked on, issues not
yet resolved, and near-term roadmap plans, to be fully discoverable by a passerby
without needing to chat in realtime with anyone else.

GitHub projects, issues, and pull requests serve this purpose beautifully. We
treat the dekkerglen/CubeCobra repository as the source of truth about what
work is complete, in progress, and not yet started. If you want to know
whether someone is working on a feature, for example, or if anyone else has
noticed the issue you're seeing, GitHub pull requests and issues are the first
place you should look. We use GitHub this way because it has great support for
discovering long-lived tickets even years after the fact. Put simply, it is
a system of record. This practice, when adhered to vigilantly, leads to
increased collective productivity and deacreased blocking between community
members and development efforts.

## How we use GitHub issues

GitHub issues are the source of truth about known issues and planned features.
If a planned feature doesn't have an open issue, it's not a planned feature.
If a bug doesn't have an open issue, it's unknown and should have one.

When we file issues, we include links to related issues and pull requests in
the issue description. GitHub makes linking to related issues and pull
requests easy by automatically expanding the text #1234 into a link to issue 1234.
These links provide a trail of breadcrumbs for community members to follow
when learning about the group's thoughts on a given bug or feature request.

When we notice a bug, we first look for an existing open issue that references the
bug. If we find one, we comment on the issue or use a GitHub reaction emoji to
indicate that we have also noticed the bug. If we don't find one, we open a new
issue about the bug. When we notice a change in a bug's behavior, or a new case in
which the bug can be replicated, we leave comments to that effect on the issue.

When we begin actively working on a feature, we comment to that effect on the
corresponding issue. This comment of "I'm working on this" indicates to other
community members that this feature is covered, and to find something else to
work on. Since GitHub does not allow community members to assign themselves to
issues, we comment in this manner to make it clear to the community what work
is currently in progress, and who owns that work.

## How we use GitHub pull requests

Pull requests are the primary way that we share our work, both finished and in
progress, with each other. When we open pull requests, we're communicating to
the community that we are actively working on code changes, and we have some
code to show for it. Though pull requests are not the source of truth about
bug/feature ownership (issues get that title), they are a very useful tool for
keeping community members abreast of one's progress without sending an @-everyone
message in Discord.

When we're working on pull requests over the course of multiple days,
sometimes we open `[WIP]` (work in progress) pull requests. We clearly
indicate that these are WIP in the description to avoid premature code reviews
from the community. When we do this, we're communicating that we'd like others
to be aware of the details of our progress without requesting a detailed code
review just yet.

When we feel that a feature we're working on is "code complete", we open pull
requests. These pull requests have titles that reference the substantive
changes they contain, descriptions that briefly summarize the
changes, and sometimes include more detailed breakdowns of the architectural
or coding approach. The goal of these descriptions is to aid in the code
review process, making it easier for a community member with no prior
knowledge of the pull request to perform a review. We also comment on our own
pull requests asking for code review, sometimes even tagging specific
individuals from whom we'd like a review.

Our pull requests have automated checks run against them, including code style
linting and unit tests. When we request reviews on pull requests, we ensure
that these checks are passing beforehand. When we add new functionality in a
pull request, we also add new tests exercising that functionality in the same
pull request. When we fix a bug in a pull request, we also add a unit test or
adjust an existing one in the same pull request to prove that the bug has been
fixed.

When we notice open pull requests with comments indicating they're ready for
review, we review each other's code. The primary goal of our code reviews is
to ensure that the code does not break existing functionality. Some secondary
goals include ensuring that the code fully satisfies the related feature
request or fixes the related bug, or that it conforms to best practices for
code efficiency and style.

We review each other's code using the GitHub "review" workflow, especially its
line-commenting feature. We leave comments on specific lines that we notice
problems with. We also make liberal use of links - to lines of code, other
issues and pull requests, or external documentation - to strengthen the points
we bring up in our code reviews. We do this also to leave a trail of
breadcrumbs explaining our thought process for future readers of the code review,
including our future selves.

When a pull request is closed or merged, there are sometimes threads left
hanging that require more work to be done. When this happens, we open issues
tracking that remaining work.

## How we use git branches

The `master` branch is the branch with changes that are pending for the next update. The release branches are forked from the `master` branch, and the latest release branch is the branch the server runs off of. First, assign yourself to an issue, and create a fork of the code. When you are finished with the feature, create a pull request back into the master branch. An admin will review your code and merge if it is accepted. Expect some comments and feedback.

## How we use Discord

Our community collaborates in an asynchronous manner because it minimizes
blocking and conflicts between various threads of work. We manage our known
bugs, feature requests, and work in progress using GitHub's asychronous tools.
Even so, there are some times when it's useful to have access to synchronous
communication with other community members.

Our community's most important use for Discord is interaction with
non-technical users of Cube Cobra. Discord is a great way to get to know the
needs and wants of the user base, and can inform plans for features and
bugfixes.

Another good use of Discord for contributors is staying abreast of the current
state of the production server. If there are new bugs being reported
frequently that require rapid response, a Discord "war room" can be the best
way to handle these reports.

Our community does not treat Discord as a system of record. Though it's not
private, we assume that everything we type on Discord will either be read
within a few minutes or not at all. Thus, when we have anything to say that we
think someone might care about later than a few minutes from now, we put it in
a GitHub issue, comment, or pull request.

### Code Style

Cube Cobra currently uses 4 languages: Javascript, Jade/PUG, CSS, and HTML. Please refer to the following guidelines with respect to each language.

#### Javascript

For Javascript please make sure your code is formatted using the JS Beautify standard. This can be done by running `npm run-script beautify`.

#### Jade/PUG CSS and HTML

For Jade/PUG, you can use the following atom package: https://atom.io/packages/jade-beautify
For HTML class names, please use all lower case name, with tokens separated by dashes (e.g. edit-blog-button). For HTML ID's, please use on alphabetic characters in camelcase.

### Development Server

The development server can be accessed at: http://162.243.163.51/
This server runs off the master branch, uses http instead of https, and has it's own database. The development server is a great way to test new features in an environment closer to the live server. Please report any bugs you see on the development server as an issue. The development server database is not wiped periodically, but it is subject to instability, so don't use it as a reliable way to store any data.

# Release Schedule

Releases are created every two weeks, on friday night. There is a feature freeze 3 days before the release where no feature pull requests will be approved, only bugfixes. This goes into affect the Tuesday before a release. This is to prevent regression on the live server. 

# How to report a bug

If you find a security vulnerability, do NOT open an issue. Send a private message to DEKKARU#2784 on discord instead. You can also email support@cubecobra.com. Bugs not related to security can be reported through GitHub issues.


# How to suggest a feature or enhancement
### Join the discord disscussion.

 https://discord.gg/Hn39bCU

# Community

We have a fairly active discord and would love for you to join the discussion.  https://discord.gg/Hn39bCU

Private Message 'DEKKARU', the admin on Discord, to gain the contributor role and unlock the contributor-only channels.

# Community feedback / product ideas

Feedback from the community is collected and synthesized into roadmap ideas in a shared document [here](https://www.notion.so/CubeCobra-community-feedback-142b06cd81994a61bd850fb5bc817cc8). To gain read/write access, PM 'DEKKARU' on Discord.
