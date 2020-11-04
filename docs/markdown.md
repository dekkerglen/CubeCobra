# Markdown Parser
CubeCobra uses [remark](https://github.com/remarkjs/remark) as its markdown parser (utilizing the [react-markdown](https://github.com/remarkjs/react-markdown) wrapper). Since developer documentation on remark and its plugin ecosystem is scattered and incomplete in places, this document aims to give an overview of how remark functions and how it utilizes extensions, at least as it pertains to CubeCobra.

## Parsing Documents
The parser takes an input stream and processes it in three main steps. 
1. The backend parser ([micromark](https://github.com/micromark/micromark/)) goes through the input stream and creates a stream of "events" - syntactic labels attached to certain positions in the text. The parser differentiates between "enter" events and "exit" events of different types, effectively splitting the document into chunks corresponding to the markdown constructs present. It utilizes a state machine to do this (several state machines, actually).
2. The labeled input stream is sent to a syntax tree creator ([mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown)). The creator takes in the input stream and the list of events, goes through each event in order, and constructs an AST describing the structure of the parsed input and the contents of each node in it.
3. The renderer takes the created AST and converts it to HTML. Nodes are converted into tags based on their type and their children fill the content of those tags. The resulting HTML document is then returned to the caller and displayed on screen.
   
## Utilizing Extensions
There are two main approaches to extending the remark parser with plugins.

### The "low-level" approach
First, we need to extend the markdown syntax with a micromark extension. Micromark extensions add new potential meaning to certain sequences of characters. A micromark extension needs to implement, at minimum, a tokenizer. 

Tokenizers are basically extensions to the state machine of micromark. They are triggered when a certain character is encountered and return a state. That state then receives the next character from the input stream and can create events, move to the next character, and return another state. Eventually, the tokenizer either accepts the sequence, in which case parsing continues from where the accepted sequence ended, or rejects it, in which case the parser returns to the state it was in before this tokenizer was started.

Once micromark finishes parsing the input, it passess its result into mdast. Because mdast ignores any labels which it doesn't have a rule for, we must also supply a mdast extension. This extension will describe how labels of the chosen type get converted into AST nodes.

Most of the plugins written for CubeCobra are implemented this way. You can also look at [remark-math](https://github.com/remarkjs/remark-math) as another fully-featured extension implemented through micromark and mdast extensions. However, this isn't the only option.

### The "high-level" approach
When we supply a plugin to remark, we give it a method called an *attacher*. An attacher can extend micromark and mdast with the extensions mentioned above. Besides that, it can also return another function, called a *transformer*. 

Transformers don't interact with micromark or mdast in any way. Rather, they are called after mdast finishes constructing the AST and then can modify the completed tree before it is passed on to rendering. 

Because a transformer can operate on a fully parsed tree and doesn't have to worry about going through the raw input, it can be easier to write and use. [Remark-breaks](https://github.com/remarkjs/remark-breaks) is a simple example of a plugin we use that's implemented purely as a transformer. 

Both approaches can also be combined. You can look at our `cardlink` plugin as an example of this; it uses a micromark extension to label parts of the input that represent card links, then utilizes a transformer to decide which exact type of card link it is.

### Which approach to use?
In general, it seems like writing transformers is quicker an easier than creating micromark extensions. This is mostly true. Despite that, you'll notice that pretty much all of our plugins implement some micromark extension. There are two main reasons for this.

First of all, sometimes it's actually easier. Let's say we're implementing support for the centering tag. That's a tag that defines a block which can span multiple paragraphs and contain any number of other markdown tags inside it. If we were to simply parse the input without modifying micromark, the first paragraph after the starting fence (`>>>`) would be interpreted as a (three times nested) block quote and the ending fence (`<<<`) would be parsed as simple text, possibly in an entirely different paragraph. Trying to walk through a thusly generated tree and reconstructing it to contain the correct centered block seems near impossible. When the syntax you're adding can significantly alter the structure of the resulting document, extending micromark is your best option.

The second issue with only using transformers has to do with escape sequences. An escape character (`\`) denotes that the following character shouldn't be treated as a special symbol by Markdown. Once an input stream passes through micromark, all escape sequences (`\x`) are replaced by their non-escaped counterparts (`x`). Let's look at our `userlink` extension to see how this might affect us.

On the surface, the userlink extension could very easily be written as a transformer. At most, it goes through text nodes, identifies the userlink pattern, and extracts it into a separate child. However, we also want to be able to escape the initial character and disable rendering it as a userlink (e.g. `\@dekkaru`). To do this with a transformer, we'd have to double our backslashes, which isn't exactly desireable.

In the end, which approach you take will depend on what your plugin is trying to achieve. You can take a look at our plugins or the official [list of remark plugins](https://github.com/remarkjs/remark/blob/main/doc/plugins.md#list-of-plugins) for inspiration.

### Rendering elements
While the parser has built-in support for converting most standard Markdown tags to HTML, we may want to override it and render some elements our own way. The parser of course also has no way of knowing how to render elements of custom types added by plugins. To modify the renderer, we can pass it a `renderers` object. Its keys are the types of elements we want to render ourselves and the corresponding values are functions that take a node of that type and return a generated HTML element.

## Other Useful Information
Hopefully this document served you as a brief overview of remark and its plugin system. You can find more information at the following sites:

- <https://github.com/micromark/micromark>
- <https://github.com/syntax-tree/mdast-util-from-markdown>
- <https://github.com/remarkjs/remark>
- <https://unifiedjs.com/learn/guide/create-a-plugin/>
- <https://github.com/micromark/common-markup-state-machine>

If you want to dive into specifics, check out the source code of some existing plugins (or the parser itself). If there are some details you still don't understand, get in touch with us through Discord and we'll be happy to help you.