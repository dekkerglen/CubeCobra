# Useful tools to help in the development/debugging processes

## Finding cycles in JS imports

Cycles in JS imports (or requires) can result in unexpected "<function> is undefined" errors at runtime, which
[this article on circular dependencies](https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de) illustrates.

A useful tool for finding those cycles is [dpdm](https://github.com/acrazing/dpdm)! It's command line takes an entry file and walks through the import tree to detect and print cycles.

The straightforward command to run is `dpdm --transform --no-warning --no-tree src/app.js` which starts from src/app.js to detect cycles. The options mean:

- `--transform`: Transforms Typescript to JS before analyzing, which omits type dependencies in the output
- `--no-warning`: Doesn't print warnings, which tend to be what was skipped
- `--no-tree`: Doesn't print the full import tree (graph)

Example output when it detects cycles looks like:

```
✔ [76/76] Analyze done!
• Circular Dependencies
  1) src/client/utils/cardutil.ts -> src/client/utils/Util.ts
  2) src/util/render.js -> src/util/util.js
```

These are simple cases where file A and B both import from each other. In worse cases you'd see more files in the `->` lists such as `A -> B -> C -> D` indicating at A and D are cyclic through other files.

Fixing circular dependencies is often as easy as refactoring functions into their own smaller files.
