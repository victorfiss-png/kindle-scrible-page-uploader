import { remote } from 'electron';

const { BrowserWindow: RemoteBrowserWindow } = remote;

export const doAmazonLogin = async () => {
  const modal =  new RemoteBrowserWindow({
    width: 450,
    height: 730,
    show: false,
  });

  
  // We can only change title after page is loaded since HTML page has its own title
  modal.once('ready-to-show', () => {
    modal.setTitle('Connect your amazon account to Obsidian');
    modal.show();
  });

  return new Promise((resolve) => {
    try {
      // If user is on the read.amazon.com url, we can safely assume they are logged in
      modal.webContents.on('did-navigate', (_event, url) => {
        if (url.startsWith('https://read.amazon.com')) {
          modal.close();
          resolve(true);
        }
      });
      modal.on('closed', () => {
        resolve(false);
      });
      void modal.loadURL('https://read.amazon.com/notebook');
    } catch {
      // Swallow error. `loadUrl` is interrupted on successful
      // login as we immediately redirect if user is logged in
    }
  });
}
