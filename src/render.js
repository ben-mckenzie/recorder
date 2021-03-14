// buttons
const videoElement = document.querySelector('video');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const videoSelectBtn = document.getElementById('video-select-btn');

const mimeType = 'video/webm; codecs=vp9';

// on click fire ipc message to node process
videoSelectBtn.addEventListener('click', () => {
    window.api.send('getSources');
});

let mediaRecorder;
let recordedChunks = [];

stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        startBtn.classList.remove('is-danger');
        startBtn.classList.add('is-primary');
        startBtn.innerText = 'Start';
    }
});

startBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'recording') {
        mediaRecorder.start();
        startBtn.classList.add('is-danger');
        startBtn.classList.remove('is-primary');
        startBtn.innerText = 'Recording';
    }
});

async function saveVideoFile() {
    const blob = new Blob(recordedChunks, {
        type: mimeType
    });
    window.api.send('showSaveDialog', {arrayBuffer: await blob.arrayBuffer()});
    recordedChunks = []; // reinitialise array for next capture
}

window.api.receive("selectSource", async data => {
    videoSelectBtn.innerText = data.videoSelect;

    // create stream from selected source and assign to video element 
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: data.sourceid
            }
        }
    });

    videoElement.srcObject = stream;
    videoElement.play();

    mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

    //media recorder event handlers
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = saveVideoFile;
});


