import React from 'react';

export type ReactSVGElement = React.FunctionComponent<React.SVGProps<SVGSVGElement> & {
  title?: string | undefined;
}>;
