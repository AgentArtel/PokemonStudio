import { IpcMainEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import { readProjectFolder } from '@src/backendTasks/readProjectData';
import { padStr } from '@utils/PadStr';
import fsPromise from 'fs/promises';
import {
  StudioCreatureResources,
  StudioCreatureForm,
  CREATURE_VALIDATOR,
  CREATURE_FORM_VALIDATOR,
  CREATURE_RESOURCES_VALIDATOR,
} from '@modelEntities/creature';
import { z } from 'zod';
import { deletePSDKDatFile } from './migrateUtils';
import { parseJSON } from '@utils/json/parse';

const PRE_MIGRATION_CREATURE_VALIDATOR = CREATURE_VALIDATOR.extend({
  forms: z.array(CREATURE_FORM_VALIDATOR.omit({ resources: true, textId: true })).nonempty(),
});
type StudioCreatureDataBeforeMigration = z.infer<typeof PRE_MIGRATION_CREATURE_VALIDATOR>;
type ComputedCreatureResources = Partial<Omit<Exclude<StudioCreatureResources, { hasFemale: false }>, 'hasFemale'>>;
const DEFAULT_CREATURE_RESOURCE: StudioCreatureResources = {
  hasFemale: false,
  icon: '000',
  iconShiny: '000',
  front: '000',
  frontShiny: '000',
  back: '000',
  backShiny: '000',
  footprint: '000',
  character: '000',
  characterShiny: '000',
  cry: '000cry',
};

type DexResource = 'footprints' | 'pokeback' | 'pokebackshiny' | 'pokefront' | 'pokefrontshiny' | 'pokeicon';

const searchDexResource = (id: number, formId: number, dexResource: DexResource, projectPath: string, isFemale: boolean, isShiny?: boolean) => {
  const resourcePath = path.join(projectPath, 'graphics/pokedex', dexResource);
  const extensions = ['.gif', '.png'];

  const resource = { name: '' };
  extensions.forEach((ext) => {
    const filename = `${padStr(id, 3)}${isFemale ? 'f' : ''}${isShiny ? 's' : ''}${formId === 0 ? '' : `_${padStr(formId, 2)}`}${ext}`;
    const result = fs.existsSync(path.join(resourcePath, filename));
    if (result) return (resource.name = filename.replace(/\.(png|gif)$/, ''));

    const resourceNameIgnoreForm = `${padStr(id, 3)}${isFemale ? 'f' : ''}${isShiny ? 's' : ''}${ext}`;
    if (fs.existsSync(path.join(resourcePath, resourceNameIgnoreForm))) return (resource.name = resourceNameIgnoreForm.replace(/\.(png|gif)$/, ''));
    return '';
  });

  if (resource.name) return resource.name;
  return isFemale ? undefined : '';
};

const searchCharacterResource = (id: number, formId: number, projectPath: string, isFemale: boolean, isShiny: boolean) => {
  const characterPath = path.join(projectPath, 'graphics/characters');

  const characterName = `${padStr(id, 3)}${isFemale ? 'f' : ''}${isShiny ? 's' : ''}_${formId}.png`;
  const result = fs.existsSync(path.join(characterPath, characterName));
  if (result) return characterName.replace('.png', '');

  return isFemale ? undefined : '';
};

const searchCry = (id: number, projectPath: string) => {
  const cryPath = path.join(projectPath, 'audio/se/cries');
  const extensions = ['.wav', '.ogg', '.mp3', '.flac'];

  const cry = { name: '' };
  extensions.forEach((ext) => {
    const filename = `${padStr(id, 3)}cry${ext}`;
    const result = fs.existsSync(path.join(cryPath, filename));
    if (result) cry.name = filename;
  });

  return cry.name;
};

const hasFemale = (resources: ComputedCreatureResources) => {
  return !!(
    resources.backF ||
    resources.backShinyF ||
    resources.characterF ||
    resources.characterShinyF ||
    resources.frontF ||
    resources.frontShinyF ||
    resources.iconF ||
    resources.iconShinyF
  );
};

const fixResourcesForFemaleOnly = (form: Pick<StudioCreatureForm, 'femaleRate'>, resources: ComputedCreatureResources): StudioCreatureResources => {
  if (form.femaleRate !== 100) {
    const resourcesValidated = CREATURE_RESOURCES_VALIDATOR.safeParse({ ...resources, hasFemale: hasFemale(resources) });
    if (resourcesValidated.success) return resourcesValidated.data;
  }

  if (resources.back) resources.backF ??= resources.back;
  if (resources.backShiny) resources.backShinyF ??= resources.backShiny;
  if (resources.character) resources.characterF ??= resources.character;
  if (resources.characterShiny) resources.characterShinyF ??= resources.characterShiny;
  if (resources.front) resources.frontF ??= resources.front;
  if (resources.frontShiny) resources.frontShinyF ??= resources.frontShiny;
  if (resources.icon) resources.iconF ??= resources.icon;
  if (resources.iconShiny) resources.iconShinyF ??= resources.iconShiny;

  const resourcesValidated = CREATURE_RESOURCES_VALIDATOR.safeParse({ ...resources, hasFemale: true });
  if (resourcesValidated.success) return resourcesValidated.data;

  return { ...DEFAULT_CREATURE_RESOURCE, ...resources, hasFemale: true };
};

const linkResources = (creature: StudioCreatureDataBeforeMigration, projectPath: string) => {
  creature.forms.forEach((form) => {
    if ('resources' in form) return; // Avoid compiling resources if it was already there
    const resources: ComputedCreatureResources = {
      icon: searchDexResource(creature.id, form.form, 'pokeicon', projectPath, false, false),
      iconF: searchDexResource(creature.id, form.form, 'pokeicon', projectPath, true, false),
      iconShiny: searchDexResource(creature.id, form.form, 'pokeicon', projectPath, false, true),
      iconShinyF: searchDexResource(creature.id, form.form, 'pokeicon', projectPath, true, true),
      front: searchDexResource(creature.id, form.form, 'pokefront', projectPath, false),
      frontF: searchDexResource(creature.id, form.form, 'pokefront', projectPath, true),
      frontShiny: searchDexResource(creature.id, form.form, 'pokefrontshiny', projectPath, false),
      frontShinyF: searchDexResource(creature.id, form.form, 'pokefrontshiny', projectPath, true),
      back: searchDexResource(creature.id, form.form, 'pokeback', projectPath, false),
      backF: searchDexResource(creature.id, form.form, 'pokeback', projectPath, true),
      backShiny: searchDexResource(creature.id, form.form, 'pokebackshiny', projectPath, false),
      backShinyF: searchDexResource(creature.id, form.form, 'pokebackshiny', projectPath, true),
      footprint: searchDexResource(creature.id, form.form, 'footprints', projectPath, false),
      character: searchCharacterResource(creature.id, form.form, projectPath, false, false),
      characterF: searchCharacterResource(creature.id, form.form, projectPath, true, false),
      characterShiny: searchCharacterResource(creature.id, form.form, projectPath, false, true),
      characterShinyF: searchCharacterResource(creature.id, form.form, projectPath, true, true),
      cry: searchCry(creature.id, projectPath),
    };
    (form as StudioCreatureForm).resources = fixResourcesForFemaleOnly(form, resources);
  });
};

export const linkResourcesToCreatures = async (_: IpcMainEvent, projectPath: string) => {
  deletePSDKDatFile(projectPath);

  const creatureData = await readProjectFolder(projectPath, 'pokemon');
  await creatureData.reduce(async (lastPromise, creature) => {
    await lastPromise;
    const creatureParsed = PRE_MIGRATION_CREATURE_VALIDATOR.safeParse(parseJSON(creature.data, creature.filename));
    if (creatureParsed.success) {
      linkResources(creatureParsed.data, projectPath);
      return fsPromise.writeFile(
        path.join(projectPath, 'Data/Studio/pokemon', `${creatureParsed.data.dbSymbol}.json`),
        JSON.stringify(creatureParsed.data, null, 2)
      );
    }
  }, Promise.resolve());
};
