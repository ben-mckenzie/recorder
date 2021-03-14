const { app, BrowserWindow, Menu, desktopCapturer, ipcMain, dialog } = require('electron');
const path = require('path');
const { writeFile } = require('fs');
const { Decoder, Reader, tools } = require('ts-ebml');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: true,
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);


// IPC functions
function selectSource(source) {
  mainWindow.webContents.send('selectSource', {'videoSelect': source.name, 'sourceid': source.id });
}

// create native menu populated with sources
ipcMain.on('getSources', async (event, args) => {
  const inputSources = await desktopCapturer.getSources({
      types: ['window', 'screen']
  });

  const videoOptionsMenu = Menu.buildFromTemplate(
      inputSources.map(source => {
          return {
              label: source.name,
              click: () => selectSource(source)
          }
      })
  );

  videoOptionsMenu.popup();
});

// save the video
ipcMain.on("showSaveDialog", async (event, args) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `video-${Date.now()}.webm`
  });

  if (!canceled) {    
    // analyse buffer and create the proper file headers
    const decoder = new Decoder();
    const reader = new Reader();
    
    const ebmlElements = decoder.decode(args.arrayBuffer);
    ebmlElements.forEach(element => reader.read(element));
    reader.stop();
    
    const seekableMetadataBuffer = tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);

    // slice the metadata off the original arraybuffer
    const body = args.arrayBuffer.slice(reader.metadataSize);

    // then frankenstein the new headers to the body
    const tmpArray = new Uint8Array(seekableMetadataBuffer.byteLength + body.byteLength);
    tmpArray.set(new Uint8Array(seekableMetadataBuffer), 0);
    tmpArray.set(new Uint8Array(body), seekableMetadataBuffer.byteLength);

    const newBuffer = tmpArray.buffer;
    
    // create node buffer and write
    const buffer = Buffer.from(newBuffer);
    writeFile(filePath, buffer, () => console.log('video saved'));
  }

});


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

