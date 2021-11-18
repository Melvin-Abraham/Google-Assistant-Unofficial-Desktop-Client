import React from 'react';
import TitleBarSecondaryActionsGroup from './TitleBarSecondaryActionsGroup';
import TitleBarWindowControlActionsGroup from './TitleBarWindowControlActionsGroup';
import './TitleBar.scss';

interface TitleBarProps {
  query?: string;
}

function TitleBar({ query = '' }: TitleBarProps) {
  return (
    <div className="title-bar-root">
      <TitleBarSecondaryActionsGroup />
      <TitleBarWindowControlActionsGroup />
    </div>
  );
}

export default TitleBar;
