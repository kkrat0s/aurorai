import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  transpilePackages: ['@aurorasense/shared', '@aurorasense/coordinator'],
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  outputFileTracingIncludes: { '/*': ['../../demo/fixtures/verified-sources.json', '../../demo/fixtures/learning-results.json'] },
};
export default config;
