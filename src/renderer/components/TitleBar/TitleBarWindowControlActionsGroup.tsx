import React from 'react';
import * as gassist from 'renderer/utils/utils';
import CloseIcon from 'res/images/close.svg?component';
import MinimizeIcon from 'res/images/minimize.svg?component';
import ExpandIcon from 'res/images/expand.svg?component';
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
    <>
      <TitleBarActionsGroup actions={actions} />
    </>
  );
}

export default TitleBarWindowControlActionsGroup;
