import { Configuration, DefinePlugin } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  return merge(baseConfig, {
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    plugins: [
      new DefinePlugin({
        E2E_ENV: JSON.stringify(process.env.CI && process.env.NODE_ENV !== 'production'),
      }),
    ]
  });
};

export default config;
