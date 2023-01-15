import React from 'react';
import TitleBarSecondaryActionsGroup from './TitleBarSecondaryActionsGroup';
import TitleBarWindowControlActionsGroup from './TitleBarWindowControlActionsGroup';
import TitleBarQuery from './TitleBarQuery';
import './TitleBar.scss';

interface TitleBarProps {
  query?: string;
}

function TitleBar({ query = '' }: TitleBarProps) {
  return (
    <div className="title-bar-root">
      <TitleBarSecondaryActionsGroup />
      <TitleBarQuery query={query} />
      <TitleBarWindowControlActionsGroup />
    </div>
  );
}

export default TitleBar;
