import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'splitFront',
  webDir: '../dist/splitFront',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
