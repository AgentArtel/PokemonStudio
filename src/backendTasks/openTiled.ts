import log from 'electron-log';
import { spawn } from 'child_process';
import path from 'path';
import { defineBackendServiceFunction } from './defineBackendServiceFunction';

export type OpenTiledPayload = {
  tiledPath: string;
  projectPath: string;
  tiledMapFilename: string;
};

const openTiled = async (payload: OpenTiledPayload) => {
  log.info('open-tiled', payload);
  const mapFilename = path.join(payload.projectPath, 'Data', 'Tiled', 'Maps', payload.tiledMapFilename + '.tmx');

  const executeCommand = (command: string, args?: readonly string[]) => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args || [], { detached: true });

      child.stdout.on('data', (data) => {
        log.info(`[Tiled] ${data}`);
      });

      child.stderr.on('data', (data) => {
        log.error(`[Tiled] ${data}`);
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.unref();
      resolve();
    });
  };

  if (process.platform === 'darwin') {
    await executeCommand('open', [payload.tiledPath, mapFilename]);
  } else if (process.platform === 'linux') {
    const linuxMapFilename = path.basename(mapFilename);
    const defaultDir = process.cwd();
    process.chdir(path.dirname(mapFilename));
    try {
      await executeCommand(payload.tiledPath, [linuxMapFilename]);
    } catch (error) {
      log.error(error);
    }
    process.chdir(defaultDir);
  } else {
    await executeCommand(payload.tiledPath, [mapFilename]);
  }
  return {};
};

export const registerOpenTiled = defineBackendServiceFunction('open-tiled', openTiled);
