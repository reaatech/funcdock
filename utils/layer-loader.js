import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

/**
 * Load layer configuration from layer.config.json
 */
export const loadLayerConfig = async (layerDir, logger = null) => {
  const configPath = path.join(layerDir, 'layer.config.json');

  try {
    await fs.access(configPath);
    const configRaw = await fs.readFile(configPath, 'utf-8');

    try {
      return JSON.parse(configRaw);
    } catch (parseError) {
      // layer.config.json exists but is malformed JSON
      if (logger) {
        logger.warn(
          `Layer ${path.basename(layerDir)}: layer.config.json contains invalid JSON, using default config. Error: ${parseError.message}`
        );
      }
      // Return default config instead of failing
      return {
        name: path.basename(layerDir),
        version: '1.0.0',
        description: '',
        runtimes: ['nodejs'],
      };
    }
  } catch (error) {
    // layer.config.json is optional, return default config
    if (error.code !== 'ENOENT' && logger) {
      // Some other error reading the file
      logger.warn(
        `Layer ${path.basename(layerDir)}: Could not read layer.config.json: ${error.message}`
      );
    }
    return {
      name: path.basename(layerDir),
      version: '1.0.0',
      description: '',
      runtimes: ['nodejs'],
    };
  }
};

/**
 * Install dependencies for a layer
 */
export const installLayerDependencies = async (layerPath) => {
  const nodejsPath = path.join(layerPath, 'nodejs');
  const packageJsonPath = path.join(nodejsPath, 'package.json');
  const packageLockPath = path.join(nodejsPath, 'package-lock.json');
  const nodeModulesPath = path.join(nodejsPath, 'node_modules');

  try {
    await fs.access(packageJsonPath);

    // Check if dependencies are already installed and up to date
    let needsInstall = false;

    try {
      // Check if node_modules exists
      await fs.access(nodeModulesPath);

      // Check if package-lock.json exists and is newer than package.json
      try {
        await fs.access(packageLockPath);
        const packageJsonStats = await fs.stat(packageJsonPath);
        const packageLockStats = await fs.stat(packageLockPath);

        // If package.json is newer than package-lock.json, we need to install
        if (packageJsonStats.mtime > packageLockStats.mtime) {
          needsInstall = true;
        }
      } catch {
        // No package-lock.json, need to install
        needsInstall = true;
      }
    } catch {
      // No node_modules, need to install
      needsInstall = true;
    }

    if (!needsInstall) {
      return { success: true, message: 'Dependencies already up to date' };
    }

    const { stderr } = await new Promise((resolve, reject) => {
      let settled = false;
      const child = spawn('npm', ['install'], {
        cwd: nodejsPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data;
      });
      child.stderr.on('data', (data) => {
        stderr += data;
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(stderr.trim() || `npm install failed with exit code ${code}`));
        }
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });

      setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error('npm install timed out after 60 seconds'));
      }, 60000);
    });

    if (stderr && !stderr.includes('npm WARN')) {
      return { success: false, error: stderr };
    }

    return { success: true, message: 'Dependencies installed successfully' };
  } catch (error) {
    // package.json doesn't exist, this is fine - layer might not have dependencies
    if (error.code === 'ENOENT') {
      return { success: true, message: 'No package.json found, skipping dependency installation' };
    }
    return { success: false, error: error.message };
  }
};

/**
 * Load a single layer
 */
export const loadLayer = async (layerDir, logger) => {
  const layerName = path.basename(layerDir);
  const nodejsPath = path.join(layerDir, 'nodejs');

  try {
    // Check if nodejs directory exists
    await fs.access(nodejsPath);
    const nodejsStats = await fs.stat(nodejsPath);

    if (!nodejsStats.isDirectory()) {
      throw new Error(
        `Layer ${layerName}: nodejs path exists but is not a directory: ${nodejsPath}`
      );
    }

    // Validate that nodejs directory contains at least one file
    try {
      const entries = await fs.readdir(nodejsPath);
      let hasAnyFile = false;
      for (const entry of entries) {
        const entryPath = path.join(nodejsPath, entry);
        try {
          const stats = await fs.stat(entryPath);
          if (stats.isFile()) {
            hasAnyFile = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!hasAnyFile && entries.length > 0) {
        logger.warn(`Layer ${layerName}: nodejs directory contains no files, only directories`);
      } else if (entries.length === 0) {
        throw new Error(`Layer ${layerName}: nodejs directory is empty`);
      }
    } catch (error) {
      if (error.message.includes('empty')) {
        throw error;
      }
      // Other errors reading directory - log but continue
      logger.warn(
        `Layer ${layerName}: Could not validate nodejs directory contents: ${error.message}`
      );
    }

    // Load layer config
    const config = await loadLayerConfig(layerDir, logger);

    // Install layer dependencies if needed
    const depsResult = await installLayerDependencies(layerDir);
    if (!depsResult.success) {
      logger.warn(`Failed to install dependencies for layer ${layerName}: ${depsResult.error}`);
    }

    return {
      name: layerName,
      path: layerDir,
      nodejsPath,
      config,
      loadedAt: new Date(),
      status: 'loaded',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Layer ${layerName} is missing nodejs directory at ${nodejsPath}`, {
        cause: error,
      });
    }
    throw error;
  }
};

/**
 * Load all layers from the layers directory
 */
export const loadAllLayers = async (layersDir, logger) => {
  const loadedLayers = new Map();

  try {
    // Create layers directory if it doesn't exist
    await fs.mkdir(layersDir, { recursive: true });

    const layerDirs = await fs.readdir(layersDir);

    for (const dir of layerDirs) {
      const layerPath = path.join(layersDir, dir);
      const stats = await fs.stat(layerPath);

      if (stats.isDirectory()) {
        try {
          const layer = await loadLayer(layerPath, logger);
          loadedLayers.set(layer.name, layer);
          logger.info(`Loaded layer: ${layer.name}`);
        } catch (error) {
          logger.error(`Failed to load layer ${dir}: ${error.message}`, { stack: error.stack });
        }
      }
    }

    return loadedLayers;
  } catch (error) {
    logger.error(`Error loading layers: ${error.message}`, { stack: error.stack });
    return loadedLayers;
  }
};

/**
 * Read function's layers.json file
 * Returns the layer name or null if no layer is specified
 */
export const readFunctionLayers = async (functionDir) => {
  const layersJsonPath = path.join(functionDir, 'layers.json');

  try {
    await fs.access(layersJsonPath);
    const layersRaw = await fs.readFile(layersJsonPath, 'utf-8');

    let layersData;
    try {
      layersData = JSON.parse(layersRaw);
    } catch (parseError) {
      throw new Error(`Invalid JSON in layers.json: ${parseError.message}`, { cause: parseError });
    }

    // Support both string format: "layer-name"
    // and object format: { "layer": "layer-name" }
    if (typeof layersData === 'string') {
      if (layersData.trim().length === 0) {
        throw new Error('Layer name cannot be empty string');
      }
      return layersData.trim();
    } else if (typeof layersData === 'object' && layersData !== null) {
      if (layersData.layer && typeof layersData.layer === 'string') {
        if (layersData.layer.trim().length === 0) {
          throw new Error('Layer name cannot be empty string');
        }
        return layersData.layer.trim();
      } else if (layersData.layer !== undefined) {
        throw new Error('Layer property must be a non-empty string');
      } else {
        throw new Error(
          'layers.json must contain either a string or an object with a "layer" property'
        );
      }
    } else {
      throw new Error('layers.json must be either a string or an object');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // layers.json doesn't exist, function has no layer
      return null;
    }
    // Re-throw validation errors
    throw error;
  }
};

/**
 * Create symlink from function's node_modules to layer's nodejs directory
 */
export const createLayerSymlink = async (functionDir, layerName, layerNodejsPath, logger) => {
  const functionNodeModules = path.join(functionDir, 'node_modules');
  const symlinkPath = path.join(functionNodeModules, layerName);

  try {
    // Ensure function's node_modules directory exists
    await fs.mkdir(functionNodeModules, { recursive: true });

    // Resolve to absolute paths for better cross-platform support
    const absoluteLayerPath = path.resolve(layerNodejsPath);
    const absoluteSymlinkPath = path.resolve(symlinkPath);

    // Check if symlink already exists
    try {
      const existingStats = await fs.lstat(absoluteSymlinkPath);
      if (existingStats.isSymbolicLink()) {
        // Remove existing symlink
        await fs.unlink(absoluteSymlinkPath);
      } else if (existingStats.isDirectory()) {
        // Remove existing directory (shouldn't happen, but handle it)
        await fs.rm(absoluteSymlinkPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Symlink doesn't exist, that's fine
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Create symlink with absolute paths
    // On Windows, check if symlinks are supported
    if (isWindows) {
      try {
        // Try to create symlink - may require admin privileges on Windows
        await fs.symlink(absoluteLayerPath, absoluteSymlinkPath, 'dir');
        logger.info(`Created symlink: ${absoluteSymlinkPath} -> ${absoluteLayerPath}`);
      } catch (windowsError) {
        // If symlink fails on Windows, try using junction (doesn't require admin)
        if (windowsError.code === 'EPERM' || windowsError.code === 'EACCES') {
          logger.warn(
            `Symlink creation failed on Windows (may require admin). Attempting junction...`
          );
          try {
            // Use junction on Windows as fallback (works without admin for directories)
            await new Promise((resolve, reject) => {
              const child = spawn(
                'cmd',
                ['/c', 'mklink', '/J', absoluteSymlinkPath, absoluteLayerPath],
                {
                  stdio: ['ignore', 'pipe', 'pipe'],
                  shell: false,
                }
              );

              let stderr = '';
              child.stderr.on('data', (data) => {
                stderr += data;
              });

              child.on('close', (code) => {
                if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(stderr.trim() || `mklink failed with exit code ${code}`));
                }
              });

              child.on('error', reject);
            });
            logger.info(`Created junction: ${absoluteSymlinkPath} -> ${absoluteLayerPath}`);
          } catch (junctionError) {
            logger.error(
              `Failed to create junction for layer ${layerName}: ${junctionError.message}`,
              { stack: junctionError.stack }
            );
            logger.alert(
              `Layer ${layerName} symlink/junction creation failed. Function may not be able to import from this layer.`
            );
            return false;
          }
        } else {
          throw windowsError;
        }
      }
    } else {
      // Unix-like systems
      await fs.symlink(absoluteLayerPath, absoluteSymlinkPath, 'dir');
      logger.info(`Created symlink: ${absoluteSymlinkPath} -> ${absoluteLayerPath}`);
    }
    return true;
  } catch (error) {
    logger.error(`Failed to create symlink for layer ${layerName}: ${error.message}`, {
      stack: error.stack,
    });
    if (isWindows) {
      logger.alert(
        `On Windows, symlinks may require administrator privileges. Consider running the server as administrator or using Developer Mode.`
      );
    }
    return false;
  }
};

/**
 * Remove layer symlink from function
 */
export const removeLayerSymlink = async (functionDir, layerName, logger) => {
  const symlinkPath = path.join(functionDir, 'node_modules', layerName);

  try {
    const stats = await fs.lstat(symlinkPath);
    if (stats.isSymbolicLink()) {
      await fs.unlink(symlinkPath);
      logger.info(`Removed symlink: ${symlinkPath}`);
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Symlink doesn't exist, that's fine
      return true;
    }
    logger.error(`Failed to remove symlink for layer ${layerName}: ${error.message}`, {
      stack: error.stack,
    });
    return false;
  }
};

/**
 * Clean up all layer symlinks from a function
 */
export const cleanupFunctionLayerSymlinks = async (functionDir, logger) => {
  const functionNodeModules = path.join(functionDir, 'node_modules');

  try {
    const entries = await fs.readdir(functionNodeModules);

    for (const entry of entries) {
      const entryPath = path.join(functionNodeModules, entry);
      try {
        const stats = await fs.lstat(entryPath);
        if (stats.isSymbolicLink()) {
          const targetPath = await fs.readlink(entryPath);
          const resolvedTarget = path.resolve(path.dirname(entryPath), targetPath);
          if (/[\\/]layers[\\/]/.test(resolvedTarget) && /[\\/]nodejs[\\/]/.test(resolvedTarget)) {
            await fs.unlink(entryPath);
            logger.info(`Cleaned up layer symlink: ${entryPath}`);
          }
        }
      } catch {
        continue;
      }
    }

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // node_modules doesn't exist, that's fine
      return true;
    }
    logger.error(`Failed to cleanup layer symlinks: ${error.message}`, { stack: error.stack });
    return false;
  }
};
