import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.egghunt.app',
  appName: 'Egg Hunt',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#f5e8f8',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#e8f4fc',
    },
  },
};

export default config;
