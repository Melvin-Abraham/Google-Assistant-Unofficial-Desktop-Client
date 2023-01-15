import React from 'react';
import './TitleBarQuery.scss';

interface TitleBarQueryProps {
  query: string;
}

function TitleBarQuery({ query = '' }: TitleBarQueryProps) {
  return (
    <div className="title-bar-query">
      {query}
    </div>
  );
}

export default TitleBarQuery;
