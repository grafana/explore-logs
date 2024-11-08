const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const config = require('./.config/jest.config');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...config,
  moduleNameMapper: {
    ...config.moduleNameMapper,
    '/@bsull\/augurs\/changepoint/': '@bsull/augurs/changepoint.js',
    '/@bsull\/augurs\/outlier/': '@bsull/augurs/outlier.js',
  },
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, '@bsull/augurs'])],
};
