# FuncDock Layer Development

Create and manage shared code layers for cross-function code reuse.

## When to Use

Use this skill when:

- Creating a new shared layer under `layers/`
- Adding utility code that multiple functions need
- Debugging layer symlink or dependency issues
- Updating layer code that affects dependent functions

## Layer Structure

```
layers/<name>/
  layer.config.json       # Metadata (required)
  nodejs/                 # Code root (required)
    package.json          # Layer dependencies
    index.js              # Main exports
    utils/
      validation.js
      formatting.js
```

## layer.config.json

```json
{
  "name": "shared-utils",
  "version": "1.0.0",
  "runtimes": ["nodejs22.x"],
  "description": "Common validation and formatting utilities"
}
```

## How Layers Work

At function load time, FuncDock reads the function's `layers.json` and creates a symlink:

```
functions/my-function/node_modules/shared-utils
  → layers/shared-utils/nodejs
```

This means functions import layers exactly like npm packages:

```js
// In a function handler
import { validateEmail } from 'shared-utils';
```

## Creating a Layer

1. Create directory: `mkdir -p layers/my-layer/nodejs`
2. Add `layer.config.json` with name and version
3. Add `nodejs/package.json`
4. Add code in `nodejs/` with proper ESM exports
5. Install dependencies: `cd layers/my-layer/nodejs && npm install`

## Referencing a Layer

In `functions/my-function/layers.json`:

```json
"my-layer"
```

Or the object form (if you need future extensibility):

```json
{ "layer": "my-layer" }
```

## Hot Reload Behavior

Changing layer code triggers reload of **all dependent functions**. The file watcher watches both `functions/` and `layers/` directories. This is powerful but be careful — a breaking change in a layer can break multiple functions simultaneously.

## Dependency Installation

Layer dependencies are installed automatically on load if:

- `nodejs/package.json` exists
- `nodejs/node_modules` is missing or `package-lock.json` is newer than `node_modules/.package-lock.json`

The platform runs `npm install` inside the layer's `nodejs/` directory.

## Windows Compatibility

On Windows, symlinks may require admin privileges. The layer loader falls back to `mklink /J` (directory junction) which works without elevation. Junctions only work for directories, which is fine since `nodejs/` is always a directory.
