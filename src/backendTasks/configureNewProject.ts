import { generatePSDKBatFileContent } from '@services/generatePSDKBatFileContent';
import log from 'electron-log';
import path from 'path';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { GAME_OPTION_CONFIG_VALIDATOR, INFO_CONFIG_VALIDATOR, SCENE_TITLE_CONFIG_VALIDATOR } from '@modelEntities/config';
import { PROJECT_VALIDATOR, StudioProject } from '@modelEntities/project';
import { defineBackendServiceFunction } from './defineBackendServiceFunction';
import { addColumnCSV, getTextFileList, getTextPath, languageAvailable, loadCSV, saveCSV } from '@utils/textManagement';
import { readProjectFolder } from './readProjectData';
import { MAP_VALIDATOR } from '@modelEntities/map';
import fsPromise from 'fs/promises';
import { parseJSON } from '@utils/json/parse';

export type ConfigureNewProjectMetaData = {
  projectStudioData: string;
  languageConfig: string;
  projectTitle: string;
  iconPath: string | undefined;
  multiLanguage: boolean;
};

const updateInfosConfig = (infosConfigPath: string, projectTitle: string) => {
  if (!existsSync(infosConfigPath)) throw new Error('infos_config.json file not found');

  const infosConfigContent = readFileSync(infosConfigPath).toString('utf-8');
  const infosConfig = INFO_CONFIG_VALIDATOR.safeParse(parseJSON(infosConfigContent, 'infos_config.json'));
  if (!infosConfig.success) throw new Error('Fail to parse infos_config.json');

  infosConfig.data.gameTitle = projectTitle;
  writeFileSync(infosConfigPath, JSON.stringify(infosConfig.data, null, 2));
};

const updateGameOptionsConfig = (gameOptionsConfigPath: string) => {
  if (!existsSync(gameOptionsConfigPath)) throw new Error('game_options_config.json file not found');

  const gameOptionsConfigContent = readFileSync(gameOptionsConfigPath).toString('utf-8');
  const gameOptionConfigValidation = GAME_OPTION_CONFIG_VALIDATOR.safeParse(parseJSON(gameOptionsConfigContent, 'game_options_config.json'));
  if (!gameOptionConfigValidation.success) throw new Error('Fail to parse game_options_config.json');

  gameOptionConfigValidation.data.order = gameOptionConfigValidation.data.order.filter((k) => k !== 'language');
  writeFileSync(gameOptionsConfigPath, JSON.stringify(gameOptionConfigValidation.data, null, 2));
};

const updateSceneTitleConfig = (sceneTitleConfigPath: string, multiLanguage: boolean) => {
  if (!existsSync(sceneTitleConfigPath)) throw new Error('scene_title_config.json file not found');

  const sceneTitleConfigContent = readFileSync(sceneTitleConfigPath).toString('utf-8');
  const sceneTitleConfigValidation = SCENE_TITLE_CONFIG_VALIDATOR.safeParse(parseJSON(sceneTitleConfigContent, 'scene_title_config.json'));
  if (!sceneTitleConfigValidation.success) throw new Error('Fail to parse scene_title_config.json');

  sceneTitleConfigValidation.data.isLanguageSelectionEnabled = multiLanguage;
  writeFileSync(sceneTitleConfigPath, JSON.stringify(sceneTitleConfigValidation.data, null, 2));
};

/**
 * Update the csv files to add missing languages if necessary
 */
const updateCSVFiles = async (projectPath: string, projectStudioData: string) => {
  const projectStudio = parseJSON(projectStudioData, projectPath) as StudioProject;
  const textFileList = getTextFileList(projectPath, true);
  await textFileList.reduce(async (lastPromise, fileId) => {
    await lastPromise;

    const textPath = path.join(projectPath, getTextPath(fileId), `${fileId}.csv`);
    const csvData = await loadCSV(textPath);
    let shouldBeSaved = false;
    projectStudio.languagesTranslation.forEach(({ code }) => {
      if (!languageAvailable(code, csvData)) {
        addColumnCSV(code, csvData);
        shouldBeSaved = true;
      }
    });
    if (shouldBeSaved) {
      log.info('configure-new-project/update', 'CSV Files', textPath);
      saveCSV(textPath, csvData);
    }
  }, Promise.resolve());
};

/**
 * Update the mtime of the maps
 */
const updateMapsMtime = async (projectPath: string) => {
  const maps = await readProjectFolder(projectPath, 'maps');
  const mtime = new Date().getTime();
  await maps.reduce(async (lastPromise, map) => {
    await lastPromise;
    const mapParsed = MAP_VALIDATOR.safeParse(parseJSON(map.data, map.filename));
    if (mapParsed.success) {
      mapParsed.data.mtime = mtime;
      await fsPromise.writeFile(
        path.join(projectPath, 'Data/Studio/maps', `${mapParsed.data.dbSymbol}.json`),
        JSON.stringify(mapParsed.data, null, 2)
      );
    }
  }, Promise.resolve());
};

const updateProjectStudioFile = async (payload: ConfigureNewProjectInput) => {
  const projectStudioPath = path.join(payload.projectDirName, 'project.studio');
  if (existsSync(projectStudioPath)) {
    const projectStudioTechnicalDemoFile = (await fsPromise.readFile(projectStudioPath)).toString('utf-8');
    const projectStudioTechnicalDemoParsed = PROJECT_VALIDATOR.safeParse(parseJSON(projectStudioTechnicalDemoFile, 'project.studio'));
    const newProjectStudioParsed = PROJECT_VALIDATOR.safeParse(JSON.parse(payload.metaData.projectStudioData));
    if (projectStudioTechnicalDemoParsed.success && newProjectStudioParsed.success) {
      const projectStudioUpdated: StudioProject = {
        ...newProjectStudioParsed.data,
        studioVersion: projectStudioTechnicalDemoParsed.data.studioVersion,
      };
      log.info('configure-new-project/update project.studio file');
      await fsPromise.writeFile(projectStudioPath, JSON.stringify(projectStudioUpdated, null, 2));
      return;
    }
  }
  log.info('configure-new-project/create project.studio file');
  await fsPromise.writeFile(projectStudioPath, payload.metaData.projectStudioData);
};

export type ConfigureNewProjectInput = { projectDirName: string; metaData: ConfigureNewProjectMetaData };

const configureNewProject = async (payload: ConfigureNewProjectInput) => {
  log.info('configure-new-project', payload);
  updateProjectStudioFile(payload);
  log.info('configure-new-project/create psdk.bat file');
  writeFileSync(path.join(payload.projectDirName, 'psdk.bat'), generatePSDKBatFileContent());
  log.info('configure-new-project/update icon');
  copyFileSync(
    payload.metaData.iconPath || path.join(payload.projectDirName, 'graphics/icons/game.png'),
    path.join(payload.projectDirName, 'project_icon.png')
  );
  log.info('configure-new-project/update language config');
  writeFileSync(path.join(payload.projectDirName, 'Data/configs/language_config.json'), payload.metaData.languageConfig);
  log.info('configure-new-project/update infos config');
  updateInfosConfig(path.join(payload.projectDirName, 'Data/configs/infos_config.json'), payload.metaData.projectTitle);
  if (!payload.metaData.multiLanguage) {
    log.info('configure-new-project/update game options config');
    updateGameOptionsConfig(path.join(payload.projectDirName, 'Data/configs/game_options_config.json'));
  }
  log.info('configure-new-project/update scene title config');
  updateSceneTitleConfig(path.join(payload.projectDirName, 'Data/configs/scene_title_config.json'), payload.metaData.multiLanguage);
  log.info('configure-new-project/update', 'CSV Files');
  await updateCSVFiles(payload.projectDirName, payload.metaData.projectStudioData);
  log.info('configure-new-project/update', 'Maps mtime');
  await updateMapsMtime(payload.projectDirName);
  return {};
};

export const registerConfigureNewProject = defineBackendServiceFunction('configure-new-project', configureNewProject);
