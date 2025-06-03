let lastSongKey = null;
let isPlaying = false;

chrome.runtime.onInstalled.addListener(() => {
  console.log("Chrome Extension Install");
  openOrCreateYTMusicWindow();
});

chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 450,
    height: 600,
    left: 100,
    top: 100
  });
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "songInfo") {
    const newSongKey = `${msg.song}::${msg.artist}::${msg.album}`;
    if (newSongKey !== lastSongKey) {
      lastSongKey = newSongKey;
      fetchLyrics(msg.song, msg.artist, msg.album);
    }
    sendResponse({ status: "ok" });
    return true;
  }

  if (msg.type === "fetchLyrics") {
    fetchLyrics(msg.song, msg.artist, msg.album);
    sendResponse({ status: "ok" });
    return true;
  }

  if (msg.type === "sendLyrics") {
    sendLyricsToYTMusicTab(msg.lyrics, sendResponse);
    return true;
  }
  if (msg.type === "playbackStatus") {
    isPlaying = message.isPlaying;

    // 팝업(또는 다른 UI)에 상태 전달
    chrome.runtime.sendMessage({
      type: "playbackStatus",
      isPlaying,
    });
  }

  if (["stopMusic", "previousMusic", "nextMusic", "setMusicTime"].includes(msg.action)) {
    openOrCreateYTMusicWindow(() => {
      executeInYTMusicTab(msg.action, msg.time);
    });
    sendResponse({ status: "ok" });
    return true;
  }
});

function fetchLyrics(song, artist, album) {
  const apiUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(song)}&artist_name=${encodeURIComponent(artist)}&album_name=${encodeURIComponent(album)}`;

  fetch(apiUrl)
    .then(res => res.json())
    .then(data => {
      chrome.runtime.sendMessage({
        type: "sendLyrics",
        lyrics: data.syncedLyrics || null
      });
    })
    .catch(() => {
      chrome.runtime.sendMessage({
        type: "sendLyrics",
        lyrics: null
      });
    });
}

function sendLyricsToYTMusicTab(lyrics, sendResponse) {
  chrome.windows.getAll({ populate: true }, (windows) => {
    for (const win of windows) {
      for (const tab of win.tabs) {
        if (tab.url && tab.url.startsWith("https://music.youtube.com")) {
          chrome.tabs.sendMessage(tab.id, {
            type: "sendLyrics",
            lyrics
          }, () => {
            sendResponse({ status: "sent" });
          });
          return;
        }
      }
    }
    sendResponse({ status: "no_tab" });
  });
}

function openOrCreateYTMusicWindow(callback) {
  chrome.windows.getAll({ populate: true }, (windows) => {
    for (const win of windows) {
      const ytTab = win.tabs.find(tab => tab.url && tab.url.startsWith("https://music.youtube.com"));
      if (ytTab) {
        injectContentScript(ytTab.id, callback);
        return;
      }
    }

    chrome.windows.create({
      url: "https://music.youtube.com",
      type: "popup",
      focused: true,
      width: 450,
      height: 600
    }, (newWin) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (changeInfo.status === "complete") {
          chrome.tabs.get(tabId, (tab) => {
            if (tab.url && tab.url.startsWith("https://music.youtube.com")) {
              chrome.tabs.onUpdated.removeListener(listener);
              injectContentScript(tab.id, callback);
            }
          });
        }
      });
    });
  });
}

function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  }).then(() => {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: "startTracking" });
      if (callback) callback(tabId);
    }, 300);
  }).catch(err => console.error("스크립트 주입 실패:", err));
}

function executeInYTMusicTab(action, time = 0) {
  chrome.windows.getAll({ populate: true }, (windows) => {
    for (const win of windows) {
      const ytTab = win.tabs.find(tab => tab.url && tab.url.startsWith("https://music.youtube.com"));
      if (ytTab) {
        // 1. 음악 제어
        chrome.scripting.executeScript({
          target: { tabId: ytTab.id },
          func: controlMusic,
          args: [action, time]
        });

        // 2. 정지면, content.js에 메시지 보내기
        if (action === "stopMusic") {
          chrome.tabs.sendMessage(ytTab.id, { type: "stopTracking" });
        }

        break;
      }
    }
  });
}



function controlMusic(action, time) {
  switch (action) {
    case "stopMusic":
      document.getElementById("play-pause-button")?.click();
      chrome.runtime.sendMessage({ type: "stopTracking" });
      sendResponse({status: "ok"});
      break;
    case "previousMusic":
      document.querySelector(".previous-button.style-scope.ytmusic-player-bar")?.click();
      break;
    case "nextMusic":
      document.querySelector(".next-button.style-scope.ytmusic-player-bar")?.click();
      break;
    case "setMusicTime":
      const video = document.querySelector("video");
  if (video) {
    video.currentTime = time;

    // 추정 타이머 상태도 동기화 (핵심!)
    lastKnownTime = time;
    lastUpdateTimestamp = Date.now();

    // 즉시 반영
    chrome.runtime.sendMessage({
      type: "timeUpdate",
      currentTime: time
    });
  }
      break;
  }
}
