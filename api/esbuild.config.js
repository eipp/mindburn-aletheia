const esbuild = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');

module.exports = {
  packager: 'npm',
  bundle: true,
  minify: true,
  sourcemap: true,
  target: 'node18',
  platform: 'node',
  concurrency: 10,
  plugins: [
    nodeExternalsPlugin({
      allowList: [],
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
}; 