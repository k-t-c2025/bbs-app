// =========================
// Firestore 初期化
// =========================
const db = firebase.firestore();
const postsRef = db.collection("posts");

// =========================
// 日付整形
// =========================
function formatDate(ts) {
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = ("0" + (d.getMonth() + 1)).slice( - 2);
  const day = ("0" + d.getDate()).slice( - 2);
  return { y, m, day };
}

// =========================
// 未読管理（localStorage）
// =========================
function loadUnread() {
  return JSON.parse(localStorage.getItem("unread")) || {};
}

function saveUnread(data) {
  localStorage.setItem("unread", JSON.stringify(data));
}

// =========================
// タイトル点滅
// =========================
let titleBlinkInterval = null;
function startTitleBlink() {
  if (titleBlinkInterval) return;
  const original = document.title;

  titleBlinkInterval = setInterval(() => {
    document.title =
      document.title === "📢 新着あり！" ? original : "📢 新着あり！";
  }, 1000);
}

function stopTitleBlink() {
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
  }
}

// =========================
// UI 追加処理
// =========================
const listArea = document.getElementById("postList");
const badge = document.getElementById("badge");

// =========================
// Firestore リアルタイム取得
// =========================
postsRef.orderBy("timestamp", "desc").onSnapshot((snap) => {

  let unread = loadUnread();
  const now = Date.now();

  listArea.innerHTML = "";
  let data = {};

  snap.forEach((doc) => {
    const post = doc.data();
    const { y, m, day } = formatDate(post.timestamp);

    if (!data[y]) data[y] = {};
    if (!data[y][m]) data[y][m] = {};
    if (!data[y][m][day]) data[y][m][day] = [];

    data[y][m][day].push({
      id: doc.id,
      text: post.text,
      ts: post.timestamp.toDate().getTime(),
    });

    // 未読処理（1週間保持）
    if (!unread[doc.id]) {
      unread[doc.id] = { ts: post.timestamp.toDate().getTime() };
    }
  });

  // 古い未読削除（1週間以上）
  for (const id in unread) {
    if (now - unread[id].ts > 7 * 24 * 60 * 60 * 1000) {
      delete unread[id];
    }
  }

  saveUnread(unread);

  // バッジ更新
  const unreadCount = Object.keys(unread).length;
  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? "inline-block" : "none";

  if (unreadCount > 0) startTitleBlink();
  else stopTitleBlink();

  // =========================
  // HTML生成（年→月→日→投稿）
  // =========================

  for (const year in data) {
    const yBox = document.createElement("div");
    yBox.className = "year-box";
    yBox.innerHTML = `<h2 class="year-tag">${year}年</h2>`;
    listArea.appendChild(yBox);

    for (const month in data[year]) {
      const mBox = document.createElement("div");
      mBox.className = "month-box";

      const mTag = document.createElement("div");
      mTag.className = "month-tag";
      mTag.textContent = `${month}月`;
      mTag.dataset.open = "0";

      // 月クリック → 開閉
      mTag.addEventListener("click", () => {
        const open = mTag.dataset.open === "1";
        mTag.dataset.open = open ? "0" : "1";
        mChild.style.display = open ? "none" : "block";
      });

      const mChild = document.createElement("div");
      mChild.className = "month-child";
      mChild.style.display = "none";

      mBox.appendChild(mTag);
      mBox.appendChild(mChild);
      yBox.appendChild(mBox);

      for (const day in data[year][month]) {
        const dBox = document.createElement("div");
        dBox.className = "day-box";

        const dTag = document.createElement("div");
        dTag.className = "day-tag";
        dTag.textContent = `${Number(day)}日`;
        dTag.dataset.open = "0";

        const dChild = document.createElement("div");
        dChild.className = "day-child";
        dChild.style.display = "none";

        // 日クリック → 開閉
        dTag.addEventListener("click", () => {
          const open = dTag.dataset.open === "1";
          dTag.dataset.open = open ? "0" : "1";
          dChild.style.display = open ? "none" : "block";
        });

        // 投稿リスト
        data[year][month][day].forEach((p) => {
          const pDiv = document.createElement("div");
          pDiv.className = "post";

          const isUnread = unread[p.id] ? "unread" : "";

          pDiv.innerHTML = `
            <div class="post-text ${isUnread}">
              ${p.text}
            </div>
          `;

          dChild.appendChild(pDiv);
        });

        dBox.appendChild(dTag);
        dBox.appendChild(dChild);
        mChild.appendChild(dBox);
      }
    }
  }
});
