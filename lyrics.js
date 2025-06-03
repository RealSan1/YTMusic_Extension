let lyrics = [];
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "sendLyrics") {
    if (!message.lyrics) {
      lyrics = [];
      showLyrics([]);
      return;
    }

    lyrics = parseLyrics(message.lyrics);
    showLyrics(lyrics);
  }

  if (message.type === "timeUpdate") {
    updateLyrics(message.currentTime);
  }
});

function parseLyrics(syncedLyrics) {
  const lines = syncedLyrics.split('\n');
  const parsed = [];

  for (const line of lines) {
    const match = line.match(/^\[(\d+):(\d+\.\d+)]\s*(.*)$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      const text = match[3].trim();
      if (text) parsed.push({ time, text });
    }
  }
  return parsed;
}

function showLyrics(lyricsData) {
  const lyricsContainer = document.querySelector(".lyrics-content");
  if (!lyricsContainer) return;

  lyricsContainer.innerHTML = "";

  if (!lyricsData || lyricsData.length === 0) {
    lyricsContainer.scrollTop = 0; // 가사 없음 → 스크롤 맨 위로
    return;
  }

  lyricsContainer.innerHTML = lyricsData.map((lyric, index) => {
    const isActive = index === 0 ? 'active' : '';
    return `<div class="lyrics-line ${isActive}" data-time="${lyric.time}">${lyric.text}</div>`;
  }).join('');

  lyricsContainer.scrollTop = 0; // 가사 새로 로딩 → 스크롤 맨 위로
}




// 가사 클릭 시 해당 시간으로 이동
document.addEventListener("click", (event) => {
  const clickedLyric = event.target.closest(".lyrics-line");
  if (clickedLyric) {
    const time = parseFloat(clickedLyric.dataset.time);
    console.log("클릭 " + time);
    chrome.runtime.sendMessage({ action: "setMusicTime", time });
    updateLyrics(time); // ✅ 이 줄 추가
  }
});

let isUserScrolling = false;
let scrollTimeout;

const lyricsContainer = document.querySelector(".lyrics-content");

lyricsContainer?.addEventListener("scroll", () => {
  isUserScrolling = true;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    isUserScrolling = false;
  }, 1000);
});

function updateLyrics(currentTime) {
  if (isUserScrolling) return;
  if (!currentTime || lyrics.length === 0) return;

  const currentLyricIndex = lyrics.findIndex((lyric, index) => {
    return currentTime >= lyric.time &&
      (index === lyrics.length - 1 || currentTime < lyrics[index + 1].time);
  });

  if (currentLyricIndex >= 0) {
    const allLyrics = lyricsContainer.querySelectorAll('.lyrics-line');
    allLyrics.forEach(lyric => lyric.classList.remove('active'));

    const activeLyric = allLyrics[currentLyricIndex];
    activeLyric.classList.add('active');

    requestAnimationFrame(() => {
      lyricsContainer.scrollTo({
        top: activeLyric.offsetTop - lyricsContainer.offsetTop - lyricsContainer.clientHeight / 2 + activeLyric.clientHeight / 2,
        behavior: 'smooth'
      });
    });
  }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && lyrics.length > 0) {
    chrome.runtime.sendMessage({ action: "requestCurrentTime" }, (response) => {
      if (response?.currentTime) {
        updateLyrics(response.currentTime);
      }
    });
  }
});


