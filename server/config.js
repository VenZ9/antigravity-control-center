import path from 'node:path';
import os from 'node:os';

const homeDir = os.homedir();
const defaultAgyDir = path.join(homeDir, '.gemini', 'antigravity-cli');

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '4300', 10),
  HOST: process.env.HOST || '127.0.0.1',
  AGY_DIR: process.env.AGY_DIR || defaultAgyDir,
  DATA_DIR: path.join(process.cwd(), 'data'),
  UPLOADS_DIR: path.join(process.cwd(), 'uploads'),
  WORKSPACE_ROOT: process.env.WORKSPACE_ROOT || homeDir,
  VERSION: '1.0.0'
};
