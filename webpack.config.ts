import path from 'path';
import { Configuration, EnvironmentPlugin } from 'webpack';
import { merge } from 'webpack-merge';

import getBaseConfig from './.config/webpack/webpack.config';

const config = async (env: any): Promise<Configuration> => {
  const baseConfig = await getBaseConfig(env);

  return merge(baseConfig, {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/'),
      },
    },
  });
};

export default config;
