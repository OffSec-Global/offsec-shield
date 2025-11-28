import type { Config } from 'tailwindcss';
import rubedoConfig from './rubedo.tailwind';

const config: Config = {
  presets: [rubedoConfig as Config],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
