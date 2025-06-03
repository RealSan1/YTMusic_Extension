document.addEventListener("DOMContentLoaded", () => {
  tryGetSongInfo();
});

function tryGetSongInfo(retry = 3) {
  chrome.tabs.query({ url: "https://music.youtube.com/*" }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].id) return;

    const tabId = tabs[0].id;

    chrome.tabs.sendMessage(tabId, { type: "startTracking" }, () => {
      chrome.tabs.sendMessage(tabId, { type: "getSongInfo" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          if (retry > 1) setTimeout(() => tryGetSongInfo(retry - 1), 500);
          return;
        }

        updateUI(response);

        if (response.song && response.artist) {
          chrome.runtime.sendMessage({
            type: "fetchLyrics",
            song: response.song,
            artist: response.artist,
            album: response.album,
          });
        }

        chrome.runtime.sendMessage({
          type: "songInfo",
          song: response.song,
          artist: response.artist,
          album: response.album,
          currentTime: response.currentTime,
        });
      });
    });
  });
}

// UI 업데이트
function updateUI({ song, artist, album, albumArt, currentTime }) {
  if (song) document.getElementById("song-title").textContent = song;
  if (artist) document.getElementById("artist-name").textContent = artist;
  if (album) document.getElementById("song-album").textContent = album;
  if (albumArt) {
    const albumArtElement = document.getElementById("albumArt");
    albumArtElement.style.backgroundImage = `url(${albumArt})`;
    albumArtElement.style.backgroundSize = 'cover';
    albumArtElement.style.backgroundPosition = 'center';
  }
  if (currentTime != null) {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById("aria-value-display").textContent = formatted;
  }
}

// 메시지 수신 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetchLyrics") {
    fetchLyrics(message.song, message.artist, message.album);
  }
  if (message.song) document.getElementById("song-title").textContent = message.song;
  if (message.artist) document.getElementById("artist-name").textContent = message.artist;
  if (message.album) document.getElementById("song-album").textContent = message.album;
  if (message.currentTime != null) {
    const minutes = Math.floor(message.currentTime / 60);
    const seconds = Math.floor(message.currentTime % 60);
    const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById("aria-value-display").textContent = formatted;
  }
  if (message.albumArt) {
    const albumArtElement = document.getElementById("albumArt");
    albumArtElement.style.backgroundImage = `url(${message.albumArt})`;
    albumArtElement.style.backgroundSize = 'cover';
    albumArtElement.style.backgroundPosition = 'center';
  }
});

// 컨트롤 버튼 이벤트
document.getElementById('stopMusic').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopMusic' });
});
document.getElementById('previousMusic').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'previousMusic' });
});
document.getElementById('nextMusic').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'nextMusic' });
});
