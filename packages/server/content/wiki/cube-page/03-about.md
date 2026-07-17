---
title: "About: Primer, Blog, and Changelog"
description: The cube's primer, its blog, and the full history of every change.
order: 3
---

The About tab is where a cube explains itself. It has three views, Primer, Blog, and Changelog,
switchable from the sidebar or the tabs on mobile.

## Primer

The primer is the cube's long-form description: what the environment is about, which archetypes are
supported, how to draft it. It's written in Cube Cobra
[Markdown](/wiki/reference/markdown): typing `[[Sol Ring]]` links the card with a hover preview,
`[[!Sol Ring]]` embeds its image, and mana symbols, tables, and headings all work, up to 100,000
characters.

Below the description sit the cube's tags. These are searchable labels; clicking one finds every
other cube that shares it.

Owners and collaborators get an **Edit Primer** button that opens the description and tag editor in
place. The button stays disabled until the cube contains at least one card, which keeps spam cubes
from publishing content.

A good primer is the single biggest thing you can do to make a cube approachable for guest
drafters. Many designers structure theirs as an archetype-by-archetype tour with a signpost card
for each pair.

## Blog

The blog is the cube's running commentary: update announcements, set review notes, retrospectives
after a draft night. Each post has a title and a Markdown body of up to 30,000 characters, and
readers can comment on posts directly.

Posts often carry a change list. When an editor commits a list update with the "Create Blog Post"
box checked (see [The List Tab](/wiki/cube-page/list)), the resulting post shows the additions and
removals alongside the write-up: the change list on one side, the reasoning on the other. An eye
icon on such posts jumps to the corresponding changelog entry.

Only the cube's owner can post, using the **Create New Blogpost** button at the top of the view,
and like the primer this requires the cube to have at least one card. The owner can edit or delete
their posts afterward with the pencil and trash icons on each post.

Blog posts travel beyond the page itself. On public cubes, each new post lands in the dashboard
feed of everyone who has liked the cube, anyone mentioned in the post gets a notification, and the
cube's RSS feed (linked from the [header](/wiki/cube-page/header-and-tools)) carries the 50 most
recent posts.

## Changelog

The changelog is the cube's full edit history, one entry per committed update, newest first. Each
entry shows its date and the cards involved: additions, removals, swaps, and edits, each marked
with its own icon. Every list commit produces an entry automatically, whether or not a blog post
was written for it.

From any entry you can go two directions:

- **View the list as it was.** Each entry links to a point-in-time snapshot of the whole cube
  immediately after that change. The snapshot is read-only but supports every display mode, sort,
  and filter from the regular list page, and it can be downloaded.
- **Compare with the present.** This opens the [compare
  view](/wiki/cube-page/header-and-tools) between that historical version and today's list, showing
  exactly what's come and gone since.

A date field above the entries jumps straight to how the cube looked on a given day, without
scrolling back through pages of history. Entries load 18 at a time, with paging controls at the top
and bottom.

## Likes

The like count in the cube header links to a page listing everyone who has liked the cube. Each
person appears with their avatar and username, linking to their profile. The other direction works
too: a user's profile lists the cubes they've liked. What liking does, and how the owner is
notified, is covered under [Cube Header and Sharing Tools](/wiki/cube-page/header-and-tools).
