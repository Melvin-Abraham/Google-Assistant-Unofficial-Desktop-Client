import React from 'react';
import { ReactComponent as SettingsIcon } from 'res/images/settings.svg';
import TitleBarActionsGroup from './TitleBarActionsGroup';
import { IconButtonProps } from '../common/IconButton/IconButton';

function TitleBarSecondaryActionsGroup() {
  const actions: IconButtonProps[] = [
    {
      Icon: SettingsIcon,
      label: 'Settings',
      onClick: () => {},
    },
  ];

  return (
    <TitleBarActionsGroup actions={actions} />
  );
}

export default TitleBarSecondaryActionsGroup;
