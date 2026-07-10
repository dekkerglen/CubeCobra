---
title: Markdown Guide
description: How to format blog posts, comments, and cube descriptions with Markdown.
order: 2
---

Cube Cobra supports regular Markdown as well as some extra features specific to our site. You can
use it in blog posts, comments, cube descriptions, and more. If you need any help, please
[contact us](/help/contact).

Most examples below are shown as a **Source** / **Result** table: the left column is what you type,
the right column is how it renders. A few block-level features are shown as the source followed by
the rendered result.

## Basic Formatting

Our Markdown syntax is based on the CommonMark specification, which includes all the common Markdown
constructs you may already be familiar with.
[Learn more about CommonMark.](https://commonmark.org/help/)

| Source                            | Result                          |
| --------------------------------- | ------------------------------- |
| `**bold text**`                   | **bold text**                   |
| `*italic text*`                   | _italic text_                   |
| `[a link](https://cubecobra.com)` | [a link](https://cubecobra.com) |

## Linking Cards

Wrap a card name in double square brackets to link it with autocard. The case doesn't matter — it
always links to the Cube Cobra card page. Add a slash to the beginning of the name to autocard the
back of a double-faced card.

| Source                   | Result                 |
| ------------------------ | ---------------------- |
| `[[Ambush Viper]]`       | [[Ambush Viper]]       |
| `[[/Delver of Secrets]]` | [[/Delver of Secrets]] |

To link a specific version, supply a [Scryfall ID](https://scryfall.com/docs/api/cards/id) after a
pipe (`|`). These IDs are in the URL of a card's page. The displayed text is whatever is to the left
of the pipe:

```
[[Old Border Mystic Snake|f098a28c-5f9b-4a2c-b109-c342365eb948]]
[[New Border Mystic Snake|38810fe4-dc72-439e-adf7-362af772b8f8]]
```

[[Old Border Mystic Snake|f098a28c-5f9b-4a2c-b109-c342365eb948]]
[[New Border Mystic Snake|38810fe4-dc72-439e-adf7-362af772b8f8]]

## Card Images

Add an exclamation point before the card name to display its image instead of a text link. Images
scale with the width of the screen. For double-faced cards, add a slash to show the back side in
autocard, and a double slash to show the back side as the image.

| Source                     | Result                   |
| -------------------------- | ------------------------ |
| `[[!Hexdrinker]]`          | [[!Hexdrinker]]          |
| `[[!/Delver of Secrets]]`  | [[!/Delver of Secrets]]  |
| `[[!//Delver of Secrets]]` | [[!//Delver of Secrets]] |

To display card images alongside each other in a row, wrap them in double angle brackets. (This
feature is not available in blog posts.)

```
<<[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]>>
```

<<[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]>>

## Symbols

Symbols can be added using curly braces. Most MTG symbols are supported. Create hybrid symbols by
including a slash, and Phyrexian mana with `/P`.

| Source                         | Result                       |
| ------------------------------ | ---------------------------- |
| `{W}{U}{B}{R}{G}`              | {W}{U}{B}{R}{G}              |
| `{W/U}{G/U}{B/R}{R/W}{B/G}`    | {W/U}{G/U}{B/R}{R/W}{B/G}    |
| `{2/W}{2/U}{2/B}{2/R}{2/G}`    | {2/W}{2/U}{2/B}{2/R}{2/G}    |
| `{W/P}{U/P}{B/P}{R/P}{G/P}`    | {W/P}{U/P}{B/P}{R/P}{G/P}    |
| `{e}{T}{q}{s}{m}{c}{X}{Y}{15}` | {e}{T}{q}{s}{m}{c}{X}{Y}{15} |

## Linking Users

You can link to a user by adding an `@` before the username.

| Source                                 | Result                               |
| -------------------------------------- | ------------------------------------ |
| `This suggestion was made by @dekkaru` | This suggestion was made by @dekkaru |

## LaTeX

You can add LaTeX math expressions using a single `$` for inline LaTeX, and double `$$` on their own
lines for block LaTeX. You can also use LaTeX in headers and block quotes.

| Source                                                           | Result                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `Some inline latex here $\frac{\sum_{i=1}^N x_i}{N}$ text after` | Some inline latex here $\frac{\sum_{i=1}^N x_i}{N}$ text after |

```
$$
\frac{\sum_{i=1}^N x_i}{N}
$$
```

$$
\frac{\sum_{i=1}^N x_i}{N}
$$

## Strikethrough

For strikethrough text, wrap the text in double tildes.

| Source                           | Result                         |
| -------------------------------- | ------------------------------ |
| `~~This text is strikethrough~~` | ~~This text is strikethrough~~ |

## Centering

You can center elements by wrapping them in triple angle brackets. Card images and multi-line
paragraphs can be centered too, and all other Markdown tags can be used inside a centered block.

```
>>> This text is centered <<<
```

> > > This text is centered <<<

```
>>> Centered Card: [[!Hexdrinker]] <<<
```

> > > Centered Card: [[!Hexdrinker]] <<<

## Tables

Tables consist of a header row, a delimiter row, and one or more data rows. The separators between
columns don't have to be vertically aligned, but it helps readability.

```
| W | U | B | R | G |
|---|---|---|---|---|
| 15| 7 | 12| 35| 0 |
```

| W   | U   | B   | R   | G   |
| --- | --- | --- | --- | --- |
| 15  | 7   | 12  | 35  | 0   |

The delimiter row can optionally contain colons indicating right, center, or left alignment. Table
cells also support basic formatting.

```
| Left align | Center align | Right align |
| :--------- | :----------: | ----------: |
| Aligned left | Aligned center | Aligned right |
| {W}{U}{B}{R} | [[Hexdrinker]] | *emphasized* |
```

| Left align   |  Center align  |   Right align |
| :----------- | :------------: | ------------: |
| Aligned left | Aligned center | Aligned right |
| {W}{U}{B}{R} | [[Hexdrinker]] |  _emphasized_ |

To use a card link or image with an ID inside a table, the pipe must be escaped with a backslash.

```
| Column A | Column B |
| - | - |
| [[!/Delver of Secrets\|28059d09-2c7d-4c61-af55-8942107a7c1f]] | Image |
| [[Old Border Mystic Snake\|f098a28c-5f9b-4a2c-b109-c342365eb948]] | Card link |
| [[Ambush Viper]] | Card link without id |
```

| Column A                                                          | Column B             |
| ----------------------------------------------------------------- | -------------------- |
| [[!/Delver of Secrets\|28059d09-2c7d-4c61-af55-8942107a7c1f]]     | Image                |
| [[Old Border Mystic Snake\|f098a28c-5f9b-4a2c-b109-c342365eb948]] | Card link            |
| [[Ambush Viper]]                                                  | Card link without id |

## Task Lists

Adding brackets to a list turns it into a task list.

```
- [x] Completed item.
- [ ] Not completed item.
  - [x] Task lists can be nested.

1. [x] Numbered task.
2. [ ] Unfinished numbered task.
```

- [x] Completed item.
- [ ] Not completed item.
  - [x] Task lists can be nested.

1. [x] Numbered task.
2. [ ] Unfinished numbered task.

## Syntax Highlighting

When writing a code block, specifying a language will enable syntax highlighting for that language.
You can specify [any of these languages](https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_HLJS.MD).

````
```javascript
const x = { a: b+1 };
console.log(this);
```
````

```javascript
const x = { a: b + 1 };
console.log(this);
```

## Header Linking

Headers can be linked to within the page by creating anchors with fragment (`#`) URLs. The content of
the fragment is the text content of the header in lowercase, with whitespace replaced by "-" (dash)
and non-letter/number characters removed. Each heading must have unique text (within the page) for
the linking to work.

Examples:

- A header with text "This is my cube" can be linked from fragment `#this-is-my-cube`.
- Non-letters such as emoji or symbols are removed: "😄 emoji ♥" can be linked from `#-emoji-`.
- Non-ASCII letters work: "The Héroïne" can be linked from `#the-héroïne`.

```
[Read the cube themes](#what-are-the-themes-of-the-cube)
[All about the money](#all-cards-must-be-less-than-50-)
```
