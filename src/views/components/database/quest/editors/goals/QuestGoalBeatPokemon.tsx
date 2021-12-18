import { useRefreshUI } from '@components/editor';
import { InputWithLeftLabelContainer, InputWithTopLabelContainer, Label, PaddedInputContainer } from '@components/inputs';
import { SelectPokemon } from '@components/selects';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { InputNumber } from './InputNumber';
import { QuestGoalProps } from './QuestGoalProps';

export const QuestGoalBeatPokemon = ({ objective }: QuestGoalProps) => {
  const { t } = useTranslation(['database_pokemon', 'database_quests']);
  const refreshUI = useRefreshUI();
  return (
    <PaddedInputContainer>
      <InputWithTopLabelContainer>
        <Label htmlFor="select-pokemon">{t('database_pokemon:pokemon')}</Label>
        <SelectPokemon
          dbSymbol={objective.objectiveMethodArgs[0] as string}
          onChange={(selected) => refreshUI((objective.objectiveMethodArgs[0] = selected.value))}
          noLabel
          noneValue
        />
      </InputWithTopLabelContainer>
      <InputWithLeftLabelContainer>
        <Label htmlFor="amount-beat-pokemon">{t('database_quests:amount')}</Label>
        <InputNumber
          name="amount-beat-pokemon"
          value={objective.objectiveMethodArgs[1] as number}
          setValue={(value: number) => refreshUI((objective.objectiveMethodArgs[1] = value))}
        />
      </InputWithLeftLabelContainer>
    </PaddedInputContainer>
  );
};
