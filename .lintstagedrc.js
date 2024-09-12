const PRETTIER_WRITE = 'prettier --write';

module.exports = {
  '**/!(package).json': [PRETTIER_WRITE],
  'src/**/*.{js,jsx,ts,tsx}': ['eslint --fix', 'tsc-files --noEmit', PRETTIER_WRITE],
  'tests/**/*.{js,jsx,ts,tsx}': ['eslint --fix', PRETTIER_WRITE],
};
