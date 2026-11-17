const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lunaDesktop", {
  setInteractive(interactive) {
    ipcRenderer.send("luna:set-interactive", Boolean(interactive));
  },
  loadThoughts() {
    return ipcRenderer.invoke("luna:load-thoughts");
  },
  getVersion() {
    return ipcRenderer.invoke("luna:get-version");
  },
  quit() {
    ipcRenderer.send("luna:quit");
  }
});
