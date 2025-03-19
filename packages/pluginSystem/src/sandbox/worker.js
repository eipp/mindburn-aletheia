const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');
const fs = require('fs').promises;
const path = require('path');

async function initializePlugin() {
  const { pluginPath, manifest, entryPoint } = workerData;
  
  // Create secure context
  const context = vm.createContext({
    console: {
      log: (...args) => console.log(`[Plugin ${manifest.id}]`, ...args),
      error: (...args) => console.error(`[Plugin ${manifest.id}]`, ...args),
      warn: (...args) => console.warn(`[Plugin ${manifest.id}]`, ...args),
    },
    require: (module) => {
      // Only allow specific modules from manifest.dependencies
      if (manifest.dependencies && manifest.dependencies[module]) {
        return require(module);
      }
      throw new Error(`Module ${module} is not allowed`);
    },
    Buffer: Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    process: {
      env: {}, // Empty environment for security
    },
  });

  // Load plugin code
  const pluginCode = await fs.readFile(path.join(pluginPath, entryPoint), 'utf8');
  const script = new vm.Script(pluginCode, {
    filename: entryPoint,
    timeout: 5000, // 5 second compile timeout
  });

  // Execute plugin in secure context
  const pluginExports = script.runInContext(context, {
    timeout: 5000, // 5 second execution timeout
  });

  return pluginExports;
}

// Handle messages from the main thread
parentPort.on('message', async (message) => {
  try {
    const { id, method, args } = message;
    const plugin = await initializePlugin();

    if (typeof plugin[method] !== 'function') {
      throw new Error(`Method ${method} not found in plugin`);
    }

    const result = await plugin[method](...args);
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      error: error.message,
    });
  }
}); 