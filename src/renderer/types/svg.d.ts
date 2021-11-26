// Ambient Declaration for SVG images as React Components
// as loaded via `vite-plugin-react-svg` Vite Plugin
declare module '*.svg?component' {
  type ReactSVGComponent = import('react').FunctionComponent<
    import('react').SVGProps<SVGSVGElement> & { title?: string }
  >

  const ReactComponent: ReactSVGComponent;
  export default ReactComponent;
}
