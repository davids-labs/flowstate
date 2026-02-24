const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send timer state updates to the main process for tray display.
   * @param {{ phase: string, remaining: number, blockName: string, routineName: string, isOverdue: boolean }} state
   */
  updateTimerState: (state) => {
    ipcRenderer.send('timer-state-update', state);
  },

  /**
   * Notify main process whether a timer is actively running (for periodic tray refresh).
   * @param {boolean} isActive
   */
  setTimerActive: (isActive) => {
    ipcRenderer.send('timer-active', isActive);
  },
});
