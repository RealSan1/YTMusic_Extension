let prevSong = null;
let prevArtist = null;
let prevAlbumArt = null;
let prevSentTime = -1;

chrome.runtime.sendMessage({ type: "readyForTracking" });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getSongInfo") {
    const info = getSongInfo();
    sendResponse(info);
    return true;
  }
  if (message.type === "startTracking") {
    waitForSongInfoReady(() => {
      startMusicTracking();
      monitorPlaybackState();
      sendResponse({ status: "started" });
    });
    return true;
  }
  if (message.type === "stopTracking") {
    stopAccurateTimeTracking();
  }
});

function monitorPlaybackState() {
  const video = document.querySelector("video");
  if (!video) return;

  video.addEventListener("play", () => {
    if (!isTracking) {
      startAccurateTimeTracking();
    }
  });
}
function waitForSongInfoReady(callback, retry = 0) {
  const playerBar = document.querySelector("ytmusic-player-bar");
  const video = document.querySelector("video");

  if (!playerBar || !video) {
    if (retry < 30) setTimeout(() => waitForSongInfoReady(callback, retry + 1), 100);
    return;
  }

  const checkAndCallback = () => {
    const { song, artist, albumArt } = getSongInfo();
    if (song && artist && albumArt) {
      callback();
      return true;
    }
    return false;
  };

  if (checkAndCallback()) return;

  const observer = new MutationObserver(() => {
    const video = document.querySelector("video");
    if (video && checkAndCallback()) {
      observer.disconnect();
    }
  });

  observer.observe(playerBar, { childList: true, subtree: true });
}


function startMusicTracking() {
  startSongChangeObserver();
  startAccurateTimeTracking();
  sendSongInfo();
}

function getSongInfo() {
  const songElement = document.querySelector(".title.style-scope.ytmusic-player-bar");
  const artistElement = document.querySelector(".byline.style-scope.ytmusic-player-bar.complex-string");
  const albumElement = document.querySelector(".image.style-scope.ytmusic-player-bar");
  const video = document.querySelector("video");

  const song = songElement ? songElement.textContent.trim() : null;
  const rawArtist = artistElement ? artistElement.textContent.trim() : null;
  const albumArt = albumElement ? albumElement.src : null;
  const currentTime = video ? video.currentTime : null;

  let artist = null;
  let album = null;

  if (rawArtist?.includes("•")) {
    [artist, album] = rawArtist.split("•").map(s => s.trim());
  } else {
    artist = rawArtist;
  }

  return { song, artist, album, albumArt, currentTime };
}


function sendSongInfo(currentTime = null) {
  const { song, artist, album, albumArt } = getSongInfo();

  if (!song || !artist || !albumArt) return;

  if (song !== prevSong || artist !== prevArtist || albumArt !== prevAlbumArt) {
    prevSong = song;
    prevArtist = artist;
    prevAlbumArt = albumArt;
    try{

    chrome.runtime.sendMessage({
      type: "songInfo",
      song,
      artist,
      album,
      albumArt,
      currentTime,
    }, (response) => {
      if (chrome.runtime.lastError) {
        // 에러 무시 또는 로깅
      }
    });}catch (e){
      
    }

  } else if (currentTime !== null && currentTime !== undefined) {
    const roundedTime = Math.floor(currentTime * 10) / 10;
    if (roundedTime !== prevSentTime) {
      prevSentTime = roundedTime;

      chrome.runtime.sendMessage({
        type: "timeUpdate",
        currentTime,
      }, (response) => {
        if (chrome.runtime.lastError) {
          // 에러 무시 또는 로깅
        }
      });
    }
  }
}

let lastKnownTime = 0;
let lastUpdateTimestamp = 0;
let isTracking = false;
let trackingLoopId = null;

function startAccurateTimeTracking() {
  isTracking = true;

  function updateFromVideo(video) {
    lastKnownTime = video.currentTime;
    lastUpdateTimestamp = Date.now();
  }

  function loop() {
  if (!isTracking) return;

  const video = document.querySelector("video");

  if (video && !video.paused && !video.ended) {
    // 재생 중이면 추적 계속
    lastKnownTime = video.currentTime;
    lastUpdateTimestamp = Date.now();
    sendSongInfo(lastKnownTime);
  } else {
    // 정지 중이면 시간 흐름 중단
    sendSongInfo(lastKnownTime);
  }

  trackingLoopId = setTimeout(loop, 100);
}


  loop();
}

function stopAccurateTimeTracking() {
  isTracking = false;
  if (trackingLoopId) {
    clearTimeout(trackingLoopId);
    trackingLoopId = null;
  }
}



function startSongChangeObserver() {
  const playerBar = document.querySelector("ytmusic-player-bar");
  if (playerBar) {
    const observer = new MutationObserver(() => sendSongInfo());
    observer.observe(playerBar, { childList: true, subtree: true });
  }
}


let lastTriggerTime = 0; // 마지막 클릭 시각 저장

function waitForTimeInfoReady(callback, retry = 0) {
  const timeInfo = document.querySelector(".time-info.style-scope.ytmusic-player-bar");
  if (timeInfo) {
    callback();
    return;
  }

  if (retry >= 50) return; // 최대 5초 (100ms x 50회)
  setTimeout(() => waitForTimeInfoReady(callback, retry + 1), 100);
}

function checkAndTriggerNext() {
  const now = Date.now();
  if (now - lastTriggerTime < 3000) return; // 3초 이내면 무시

  const temp = document.querySelector(".time-info.style-scope.ytmusic-player-bar");
  if (!temp) return;

  const [currentTimeStr, totalTimeStr] = temp.textContent.trim().split(" / ");
  const parseTime = (t) => {
    const parts = t.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  };

  const currentTime = parseTime(currentTimeStr);
  const totalTime = parseTime(totalTimeStr);

  if (totalTime <= 0 || currentTime <= 0) return;
  if (totalTime - currentTime <= 2) {
    const nextButton = document.querySelector(".next-button.style-scope.ytmusic-player-bar");
    if (nextButton) {
      nextButton.click();
      lastTriggerTime = now; // 클릭 시각 업데이트
    }
  }
}

waitForTimeInfoReady(() => {
  setInterval(checkAndTriggerNext, 150);
});
