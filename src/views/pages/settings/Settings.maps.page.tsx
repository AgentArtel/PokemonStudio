import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageEditor, PageTemplate } from '@components/pages';
import { InputWithLeftLabelContainer, Label, Toggle, InputWithTopLabelContainer, DropInput, FileInput } from '@components/inputs';
import { useProjectStudio } from '@hooks/useProjectStudio';
import styled from 'styled-components';
import { Link } from '@components/Link';
import LinkStyle from '@components/Link/LinkStyle';
import { getSetting, updateSettings } from '@utils/settings';
import { SettingsEditorAndDeletionKeys, SettingsEditorOverlay } from '@components/settings/editors/SettingsEditorOverlay';
import { useDialogsRef } from '@hooks/useDialogsRef';
import { basename } from '@utils/path';
import { showNotification } from '@utils/showNotification';

const DownloadMessageContainer = styled.div`
  display: flex;
  gap: 4px;
  ${({ theme }) => theme.fonts.normalSmall}
  color: ${({ theme }) => theme.colors.text400};

  ${LinkStyle} {
    color: ${({ theme }) => theme.colors.primaryBase};
  }
`;

export const SettingsMapsPage = () => {
  const { projectStudioValues: projectStudio } = useProjectStudio();
  const [tiledPath, setTiledPath] = useState(getSetting('tiledPath'));
  const dialogsRef = useDialogsRef<SettingsEditorAndDeletionKeys>();
  const { t } = useTranslation(['settings', 'settings_maps']);
  const isWin32 = window.api.platform === 'win32';

  const handleFileChoosen = (filePath: string) => {
    if (isWin32 && basename(filePath).toLowerCase() !== 'tiled.exe') {
      showNotification('danger', t('settings:map_management'), t('settings_maps:tiled_path_invalid_path_error'));
      return;
    }

    setTiledPath(filePath);
    updateSettings('tiledPath', filePath);
  };

  const handleFileClear = () => {
    setTiledPath('');
    updateSettings('tiledPath', '');
  };

  return (
    <PageTemplate title={t('settings:map_management')} size="default">
      <PageEditor title="Tiled" editorTitle={t('settings:map_management')}>
        <InputWithLeftLabelContainer>
          <Label>{t('settings_maps:use_tiled')}</Label>
          <Toggle
            name="use_tiled"
            checked={projectStudio.isTiledMode || false}
            onChange={(event) => {
              event.preventDefault();
              dialogsRef.current?.openDialog('use_tiled_message_box', true);
            }}
            disabled={projectStudio.isTiledMode || false}
          />
        </InputWithLeftLabelContainer>
        {projectStudio.isTiledMode && (
          <InputWithTopLabelContainer>
            <Label>{t('settings_maps:tiled_path')}</Label>
            {tiledPath ? (
              <FileInput
                filePath={tiledPath}
                name={isWin32 ? t('settings_maps:tiled_exe') : 'Tiled'}
                extensions={isWin32 ? ['exe'] : ['*']}
                onFileChoosen={handleFileChoosen}
                onFileClear={handleFileClear}
                isAbsolutePath
                showFullPath
                noIcon
              />
            ) : (
              <DropInput
                name={isWin32 ? t('settings_maps:tiled_exe') : 'Tiled'}
                extensions={isWin32 ? ['exe'] : ['*']}
                onFileChoosen={handleFileChoosen}
              />
            )}
            <DownloadMessageContainer>
              {t('settings_maps:download_message')}
              <Link external href="https://www.mapeditor.org" text={t('settings_maps:official_website')} />
            </DownloadMessageContainer>
          </InputWithTopLabelContainer>
        )}
        <SettingsEditorOverlay ref={dialogsRef} />
      </PageEditor>
    </PageTemplate>
  );
};
