import { contextBridge } from 'electron';
import * as gassist from 'main/api/renderer';

// Exposes the `gassist` API in renderer process globally
contextBridge.exposeInMainWorld('gassist', gassist);
