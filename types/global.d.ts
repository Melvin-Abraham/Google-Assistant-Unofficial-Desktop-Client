import { BrowserWindow } from 'electron';

declare global {
  namespace NodeJS {
    interface Global {
      /**
       * Reference to the assistant renderer process window
       * @custom
       */
      assistantWindow: BrowserWindow;
    }
  }
}
