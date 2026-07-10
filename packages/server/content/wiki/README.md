# Cube Cobra Wiki content

This folder holds the on-site wiki that appears at [cubecobra.com/wiki](https://cubecobra.com/wiki).
Every page is a plain Markdown file — **you do not need to write any code to add or edit a page.**
You can edit files directly on GitHub and open a pull request; once it is merged, the page goes live.

## How it works

- **Folders become categories.** A folder like `getting-started/` shows up as a section in the wiki
  sidebar.
- **`.md` files become pages.** `getting-started/creating-a-cube.md` is served at
  `/wiki/getting-started/creating-a-cube`.
- **Ordering.** Prefix a file or folder name with a number to control its position in the sidebar,
  e.g. `01-creating-a-cube.md`. The number is stripped from the URL. You can also set `order:` in the
  frontmatter (see below), which takes priority.
- **`index.md`** inside a folder is that category's landing page, and its frontmatter provides the
  category's title, description, and order.
- **`README.md`** files (like this one) are ignored and never shown on the site.

## Frontmatter

Each page may start with an optional frontmatter block that sets its title and other metadata:

```markdown
---
title: Creating a Cube
description: How to make your first cube on Cube Cobra.
order: 1
---

Your content goes here...
```

The `title` from the frontmatter is shown as the page's heading automatically, so you don't need to
repeat it as a `# Heading` at the top of the body. If you omit `title`, it is derived from the file
name. Use `##` and `###` headings within the body to structure the page.

## Formatting

Wiki pages support the full Cube Cobra Markdown syntax — card links like `[[Lightning Bolt]]`,
mana symbols like `{W}{U}{B}{R}{G}`, card images, tables, and more. See the
[Markdown Guide](https://cubecobra.com/help/markdown) for everything available.

## Adding a page

1. Create a new `.md` file in the appropriate folder (or make a new folder for a new category).
2. Add a frontmatter block with at least a `title`.
3. Write your content in Markdown.
4. Open a pull request.

That's it — no build step or configuration to touch.
