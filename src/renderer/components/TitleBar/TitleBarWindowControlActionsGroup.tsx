import React from 'react';
import gassist from 'gassist';
import { ReactComponent as CloseIcon } from 'res/images/close.svg';
import { ReactComponent as MinimizeIcon } from 'res/images/minimize.svg';
import { ReactComponent as ExpandIcon } from 'res/images/expand.svg';
import TitleBarActionsGroup from './TitleBarActionsGroup';
import { IconButtonProps } from '../common/IconButton/IconButton';

function TitleBarWindowControlActionsGroup() {
  const actions: IconButtonProps[] = [
    {
      Icon: ExpandIcon,
      label: 'Expand',
      onClick: () => {},
    },
    {
      Icon: MinimizeIcon,
      label: 'Minimize',
      onClick: () => gassist.window.minimizeWindow(),
    },
    {
      Icon: CloseIcon,
      label: 'Close',
      onClick: () => gassist.window.closeWindow(),
    },
  ];

  return (
    <TitleBarActionsGroup actions={actions} />
  );
}

export default TitleBarWindowControlActionsGroup;
