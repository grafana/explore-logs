const PRETTIER_WRITE = 'prettier --write';

module.exports = {
  '**/!(package).json': [PRETTIER_WRITE],
  'tests/*.spec.ts': [PRETTIER_WRITE],
  'src/**/*.{js,jsx,ts,tsx}': ['eslint --fix', 'tsc-files --noEmit', PRETTIER_WRITE],
};
