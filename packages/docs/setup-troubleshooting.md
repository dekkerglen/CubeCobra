# Setup and Troubleshooting Guide

This document contains common setup issues and their solutions when developing CubeCobra.

## Windows-Specific Issues

### TensorFlow.js Node Module Loading Error

**Problem:**
When running the development server on Windows, you may encounter this error:

```
[nodemon] starting `ts-node -r tsconfig-paths/register ./src/index.ts -r tsconfig-paths/register src/index.ts`
Error: The specified module could not be found.
\\?\D:\Repos\CubeCobra\node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node
    at Object..node (node:internal/modules/cjs/loader:1921:18)
    at Module.load (node:internal/modules/cjs/loader:1465:32)
    at Function._load (node:internal/modules/cjs/loader:1282:12)
    at TracingChannel.traceSync (node:diagnostics_channel:322:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)
    at Module.require (node:internal/modules/cjs/loader:1487:12)
    at require (node:internal/modules/helpers:135:16)
    at Object.<anonymous> (D:\Repos\CubeCobra\node_modules\@tensorflow\tfjs-node\dist\index.js:72:16)
    at Module._compile (node:internal/modules/cjs/loader:1730:14)
    at node:internal/modules/cjs/loader:1895:10 {
  code: 'ERR_DLOPEN_FAILED'
}
```

**Solution:**
This is a known issue with TensorFlow.js on Windows related to missing DLL files. Follow these steps:

1. Navigate to your project's `node_modules\@tensorflow\tfjs-node\deps\lib\` directory
2. Locate the `tensorflow.dll` file
3. Copy `tensorflow.dll` to the `node_modules\@tensorflow\tfjs-node\lib\napi-v6\` directory (or the appropriate napi version directory that matches your Node.js version)

**Example paths:**
- From: `D:\Repos\CubeCobra\node_modules\@tensorflow\tfjs-node\deps\lib\tensorflow.dll`
- To: `D:\Repos\CubeCobra\node_modules\@tensorflow\tfjs-node\lib\napi-v6\tensorflow.dll`

**Reference:**
This solution is documented in the official TensorFlow.js GitHub issue: https://github.com/tensorflow/tfjs/issues/4116

**Note:** You may need to repeat this process after running `npm install` or `npm ci` as it may overwrite the copied files.

### Alternative Solutions

If the above solution doesn't work, try these alternatives:

1. **Check Node.js version compatibility**: Ensure you're using a Node.js version that's compatible with the TensorFlow.js version in the project.

2. **Reinstall node modules**: Sometimes a clean reinstall can resolve native module issues:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Use Windows Subsystem for Linux (WSL)**: If you continue to have issues, consider using WSL for development as it typically has fewer native module compatibility issues.

## General Issues

### Module Import/Export Errors

**Problem:**
Errors related to ES modules vs CommonJS compatibility, such as:
```
ReferenceError: exports is not defined
```

**Solution:**
This typically indicates a mismatch between ES modules and CommonJS. Check:
1. The `package.json` for `"type": "module"` declarations
2. Import statements use the correct syntax for the module type
3. TypeScript configuration in `tsconfig.json` matches the expected module system

### Build Errors

For TypeScript compilation errors, ensure:
1. All dependencies have proper type definitions
2. TypeScript configuration is properly set up
3. Path mappings in `tsconfig.json` are correct

## Getting Help

If you encounter issues not covered in this guide:
1. Check the existing GitHub issues for similar problems
2. Create a new issue with detailed error messages and system information
3. Include your operating system, Node.js version, and npm version
