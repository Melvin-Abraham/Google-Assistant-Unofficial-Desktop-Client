import React, { useEffect, useRef } from 'react';
import InitView from 'components/views/InitView/InitView';
import useHistory from 'renderer/hooks/useHistory';
import './ResponseViewlet.scss';

function ResponseViewlet() {
  const responseViewletWrapperRef = useRef<HTMLDivElement>(null);
  const { currentHistoryItem, historyHead } = useHistory();

  useEffect(() => {
    if (
      responseViewletWrapperRef.current === null
      || !(currentHistoryItem?.transformedScreenData)
    ) {
      return;
    }

    responseViewletWrapperRef.current.innerHTML = '';
    responseViewletWrapperRef.current.appendChild(currentHistoryItem.transformedScreenData);
  }, [currentHistoryItem]);

  return (
    <div className="viewlet-root" key={historyHead}>
      {historyHead === -1 && <InitView />}
      {currentHistoryItem !== undefined && (
        <div
          className="response-wrapper"
          ref={responseViewletWrapperRef}
        />
      )}
    </div>
  );
}

export default ResponseViewlet;
