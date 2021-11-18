import React from 'react';
import SettingsIcon from 'res/images/settings.svg?component';
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
    <>
      <TitleBarActionsGroup actions={actions} />
    </>
  );
}

export default TitleBarSecondaryActionsGroup;
