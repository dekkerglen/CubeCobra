# Nearley Parser

CubeCobra uses [Nearley](https://nearley.js.org/) to generate parsers for card filtering syntax. This allows users to write complex queries like `cmc>=3 AND color:red` to filter cards.

## Overview

Nearley is a parser toolkit that compiles grammar definitions into JavaScript parsers. CubeCobra uses it to generate the card filter parser that enables powerful search functionality.

### Generated Code

**Important**: The generated JavaScript parser code **is checked into version control**. This means you'll see compiled parser files alongside the source grammar files.

### Grammar Files

The Nearley grammar files are located in:

```
packages/utils/nearley/
├── cardFilters.ne    # Main card filter grammar
├── filterBase.ne     # Base grammar components
├── values.ne         # Value type definitions
└── helper.sh         # Build script
```

### Generated Files

The compiled parser files are generated at:

```
packages/utils/src/generated/filtering/cardFilters.js
packages/client/src/generated/filtering/cardFilters.js
```

## Grammar Structure

### Main Grammar File

- **`cardFilters.ne`**: Defines the complete syntax for card filtering
- **`filterBase.ne`**: Contains base grammar rules and operators
- **`values.ne`**: Defines value types (strings, numbers, colors, etc.)

### Filter Syntax Examples

The grammar supports complex filtering expressions:

```
# Simple filters
name:lightning
cmc:3
color:red

# Operators
cmc>=4
power<=2
toughness>0

# Logical combinations
(cmc>=3 AND color:red) OR type:creature
name:bolt OR name:shock
color:white AND (cmc<=2 OR type:instant)
```

## Regenerating Parser Code

When you modify any of the `.ne` grammar files, you **must** regenerate the parser code.

### Command

From the root directory, run:

```bash
npm run nearley
```

This command:

1. Navigates to the utils package
2. Runs the `helper.sh` script
3. Compiles `.ne` files using `nearleyc`
4. Generates new JavaScript parser files
5. Copies the parser to both utils and client packages

### When to Regenerate

You must regenerate the parser when you:

- Modify any `.ne` grammar file
- Add new filter syntax
- Change operator precedence
- Update value type definitions
- Fix parsing bugs

### Automatic Regeneration

The parser is automatically regenerated during:

- Initial setup (`npm run setup`)
- Docker container builds
- Production deployments

## Development Workflow

### 1. Modify Grammar

Edit the appropriate `.ne` file in `packages/utils/nearley/`:

```nearley
# Example addition to cardFilters.ne
newFilter -> "rarity" ":" rarityValue {% filterFunction %}
rarityValue -> "common" | "uncommon" | "rare" | "mythic"
```

### 2. Regenerate Parser

```bash
npm run nearley
```

### 3. Test Changes

```bash
# Run filter tests
npm test -- filtering

# Test specific filter functionality
npm test -- cardFilters
```

### 4. Commit Changes

Commit both the grammar changes and generated files:

```bash
git add packages/utils/nearley/cardFilters.ne
git add packages/utils/src/generated/filtering/cardFilters.js
git add packages/client/src/generated/filtering/cardFilters.js
git commit -m "Add rarity filter support"
```

## Testing Filters

### Unit Tests

Filter parsing is tested in:

```
packages/tests/cards/filtering.test.ts
packages/tests/cards/filterOperations.test.ts
```

### Manual Testing

Test filters in the application:

1. Navigate to any cube page
2. Use the card search/filter input
3. Try your new filter syntax
4. Verify results match expectations

## Troubleshooting

### Common Issues

**Syntax Errors in Grammar**

```bash
# Check grammar syntax
nearleyc packages/utils/nearley/cardFilters.ne
```

**Parser Not Updated**

- Ensure you ran `npm run nearley` after grammar changes
- Check that generated files have recent timestamps
- Verify changes are reflected in both utils and client packages

**Test Failures**

- Update test cases to match new grammar
- Add tests for new filter functionality
- Check that filter functions handle new syntax correctly

### Grammar Debugging

**Enable Debug Mode**

```javascript
// In parser usage code
const parser = new Parser(Grammar.fromCompiled(cardFilters), { debug: true });
```

**Test Grammar Incrementally**

```bash
# Test specific grammar rules
nearley-test cardFilters.ne --input "cmc:3"
```

## Performance Considerations

### Parser Size

- Keep grammar rules focused and minimal
- Avoid deeply nested rules when possible
- Consider parse-time complexity for common queries

### Caching

- Generated parsers are cached in memory
- Complex filters may benefit from result caching
- Consider memoization for frequently used patterns

## Advanced Usage

### Custom Filter Functions

Define custom processing in grammar files:

```nearley
customFilter -> "special" ":" value {%
  function(data) {
    return { type: 'special', value: data[2] };
  }
%}
```

### Error Handling

The grammar includes error recovery for common mistakes:

- Missing operators
- Unmatched parentheses
- Invalid value types

## Contributing

When contributing filter improvements:

1. **Plan the syntax** - Consider user experience and existing patterns
2. **Update grammar** - Modify appropriate `.ne` files
3. **Regenerate parser** - Run `npm run nearley`
4. **Add tests** - Cover new functionality thoroughly
5. **Update documentation** - Document new filter syntax
6. **Test thoroughly** - Verify in both development and production scenarios

## Next Steps

- [Parser Documentation](./parser.md) - Existing parser documentation
- [Development Tools](./dev-tools.md) - Development environment setup
- [Testing Guide](./testing.md) - Running and writing tests
