import LiveReloadPlugin from 'webpack-livereload-plugin';
import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig from './.config/webpack/webpack.config';
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const config = async (env: any): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  return merge(baseConfig, {
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    plugins: [
      // new BundleAnalyzerPlugin()
      new LiveReloadPlugin({
        port: 35828,
        protocol: 'http',
        hostname: 'localhost',
        delay: 1000,
        appendScriptTag: true,
      }),
    ],
  });
};

export default config;
