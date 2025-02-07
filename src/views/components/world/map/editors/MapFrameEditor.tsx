import React, { forwardRef, useRef, useState } from 'react';
import { Editor } from '@components/editor';
import { useTranslation } from 'react-i18next';
import { useMapPage } from '@hooks/usePage';
import { useUpdateMap } from './useUpdateMap';
import { useGetEntityDescriptionText, useGetEntityNameText, useSetProjectText } from '@utils/ReadingProjectText';
import { useDialogsRef } from '@hooks/useDialogsRef';
import { MAP_DESCRIPTION_TEXT_ID, MAP_NAME_TEXT_ID } from '@modelEntities/map';
import { EditorHandlingClose, useEditorHandlingClose } from '@components/editor/useHandleCloseEditor';
import {
  FileInput,
  Input,
  InputContainer,
  InputWithLeftLabelContainer,
  InputWithTopLabelContainer,
  Label,
  MultiLineInput,
  PaddedInputContainer,
} from '@components/inputs';
import { MapTranslationOverlay, TranslationEditorTitle } from './MapTranslationOverlay';
import { TranslateInputContainer } from '@components/inputs/TranslateInputContainer';
import { DropInput } from '@components/inputs/DropInput';
import { basename } from '@utils/path';
import { useUpdateMapModified } from './useUpdateMapModified';
import { cloneEntity } from '@utils/cloneEntity';
import { TextInputError } from '@components/inputs/Input';
import { useMapCopy } from '@hooks/useMapCopy';
import { useLoaderRef } from '@utils/loaderContext';

type MapFrameEditorProps = {
  closeDialog: () => void;
};

export const MapFrameEditor = forwardRef<EditorHandlingClose, MapFrameEditorProps>(({ closeDialog }, ref) => {
  const { t } = useTranslation('database_maps');
  const { map, state } = useMapPage();
  const updateMap = useUpdateMap(map);
  const updateMapModified = useUpdateMapModified();
  const dialogsRef = useDialogsRef<TranslationEditorTitle>();
  const getMapName = useGetEntityNameText();
  const getMapDescription = useGetEntityDescriptionText();
  const setText = useSetProjectText();
  const mapCopy = useMapCopy();
  const loaderRef = useLoaderRef();
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const stepsAverageRef = useRef<HTMLInputElement>(null);
  const [tiledFilename, setTiledFilename] = useState<string>(map.tiledFilename);
  const [error, setError] = useState<string>('');

  const saveTexts = () => {
    if (!nameRef.current || !descriptionRef.current) return;

    setText(MAP_NAME_TEXT_ID, map.id, nameRef.current.value);
    setText(MAP_DESCRIPTION_TEXT_ID, map.id, descriptionRef.current.value);
  };

  const canClose = () => !!nameRef.current?.value && !dialogsRef.current?.currentDialog && !!stepsAverageRef.current?.validity.valid;
  const onClose = () => {
    if (!nameRef.current || !descriptionRef.current || !stepsAverageRef.current || !canClose()) return;

    const mapModifiedUpdated = cloneEntity(state.mapsModified);
    if (tiledFilename === '') {
      const index = mapModifiedUpdated.findIndex((dbSymbol) => dbSymbol === map.dbSymbol);
      if (index !== -1) {
        mapModifiedUpdated.splice(index, 1);
        updateMapModified(mapModifiedUpdated);
      }
    } else if (tiledFilename !== map.tiledFilename && !mapModifiedUpdated.includes(map.dbSymbol)) {
      mapModifiedUpdated.push(map.dbSymbol);
      updateMapModified(mapModifiedUpdated);
    }

    const stepsAverage = isNaN(stepsAverageRef.current.valueAsNumber) ? map.stepsAverage : stepsAverageRef.current.valueAsNumber;
    setText(MAP_NAME_TEXT_ID, map.id, nameRef.current.value);
    setText(MAP_DESCRIPTION_TEXT_ID, map.id, descriptionRef.current.value);
    updateMap({ stepsAverage, tiledFilename: basename(tiledFilename, '.tmx'), tileMetadata: tiledFilename === '' ? null : map.tileMetadata });
    saveTexts();
  };
  useEditorHandlingClose(ref, onClose, canClose);

  const handleTranslateClick = (editorTitle: TranslationEditorTitle) => () => {
    saveTexts();
    setTimeout(() => dialogsRef.current?.openDialog(editorTitle), 0);
  };

  const onTranslationOverlayClose = () => {
    if (!nameRef.current || !descriptionRef.current) return;

    nameRef.current.value = nameRef.current.defaultValue;
    descriptionRef.current.value = descriptionRef.current.defaultValue;
  };

  const copyTmxFile = (tmxFile: string) => {
    setError('');
    mapCopy(
      { tmxFile },
      () => {
        loaderRef.current.close();
        setTiledFilename(tmxFile);
      },
      (errorMessage) => {
        loaderRef.current.close();
        setError(errorMessage);
      },
      (genericError) => {
        setTimeout(() => loaderRef.current.setError('importing_tiled_maps_error', genericError, true), 200);
        closeDialog();
      }
    );
  };

  return (
    <Editor type="edit" title={t('information')}>
      <InputContainer size="l">
        <PaddedInputContainer size="m">
          <InputWithTopLabelContainer>
            <Label htmlFor="name" required>
              {t('name')}
            </Label>
            <TranslateInputContainer onTranslateClick={handleTranslateClick('translation_name')}>
              <Input type="text" name="name" defaultValue={getMapName(map)} ref={nameRef} placeholder={t('example_name')} />
            </TranslateInputContainer>
          </InputWithTopLabelContainer>
          <InputWithTopLabelContainer>
            <Label htmlFor="descr">{t('description')}</Label>
            <TranslateInputContainer onTranslateClick={handleTranslateClick('translation_description')}>
              <MultiLineInput id="descr" defaultValue={getMapDescription(map)} ref={descriptionRef} placeholder={t('example_description')} />
            </TranslateInputContainer>
          </InputWithTopLabelContainer>
          <InputWithLeftLabelContainer>
            <Label htmlFor="steps-average">{t('steps_average')}</Label>
            <Input type="number" name="steps-average" min="1" max="999" defaultValue={map.stepsAverage} ref={stepsAverageRef} />
          </InputWithLeftLabelContainer>
          <InputWithTopLabelContainer>
            <Label htmlFor="tiled-file">{t('map_made_tiled')}</Label>
            {!tiledFilename ? (
              <DropInput name={t('tiled_file')} extensions={['tmx']} onFileChoosen={copyTmxFile} showAcceptedFormat />
            ) : (
              <FileInput
                filePath={`Data/Tiled/Maps/${basename(tiledFilename, '.tmx')}.tmx`}
                name={t('tiled_file')}
                extensions={['tmx']}
                onFileChoosen={copyTmxFile}
                onFileClear={() => {
                  setTiledFilename('');
                  setError('');
                }}
                noIcon
              />
            )}
            {error && <TextInputError>{error}</TextInputError>}
          </InputWithTopLabelContainer>
        </PaddedInputContainer>
      </InputContainer>
      <MapTranslationOverlay map={map} onClose={onTranslationOverlayClose} ref={dialogsRef} />
    </Editor>
  );
});
MapFrameEditor.displayName = 'MapFrameEditor';
