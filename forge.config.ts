import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

import { mainConfig } from './config/webpack.main.config';
import { rendererConfig } from './config/webpack.renderer.config';

const windowsSpecificResources = process.platform === 'win32' ? ['psdk-binaries'] : [];
const config: ForgeConfig = {
  packagerConfig: {
    icon: './assets/icon',
    extraResource: ['new-project.zip', ...windowsSpecificResources],
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
              config: {
                // https://github.com/electron/forge/issues/3115#issuecomment-1387391556 (it's funny how this solution is 1 week old)
                ...rendererConfig,
                plugins: [],
              },
            },
          },
        ],
      },
      devServer: { liveReload: false },
      devContentSecurityPolicy:
        "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval'; font-src 'self' static:; img-src 'self' project:; media-src 'self' project:",
    }),
  ],
};

export default config;