import React from 'react';
import IconButton, { IconButtonProps } from '../common/IconButton/IconButton';
import './TitleBarActionsGroup.scss';

interface TitleBarActionsGroupProps {
  actions: IconButtonProps[];
}

function TitleBarActionsGroup({ actions }: TitleBarActionsGroupProps) {
  return (
    <div className="title-bar-actions-group">
      {actions.map((action) => (
        <IconButton
          key={action.label}
          label={action.label}
          Icon={action.Icon}
          onClick={action.onClick}
        />
      ))}
    </div>
  );
}

export default TitleBarActionsGroup;
