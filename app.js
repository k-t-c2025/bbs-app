// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyC10ERewIkpD_ZjQPneF3hWyunEKwBMCAQ",
  authDomain: "keijibann-b44b8.firebaseapp.com",
  projectId: "keijibann-b44b8",
  storageBucket: "keijibann-b44b8.appspot.com",
  messagingSenderId: "267259675864",
  appId: "1:267259675864:web:971536e4f188051db5c3ad",
  measurementId: "G-WW1ZETJDN8"
};

// 初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML要素
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");
const postsDiv = document.getElementById("posts");

const monthTagsDiv = document.getElementById("monthTags");
const dayTagsDiv = document.getElementById("dayTags");


// --------------------------
// 投稿
// --------------------------
sendBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "名無し").trim();
  const text = (textInput.value || "").trim();
  if (!text) return;

  await addDoc(collection(db, "posts"), {
    name,
    text,
    createdAt: serverTimestamp()
  });

  textInput.value = "";
});


// --------------------------
// Firestore → グループ化して表示
// --------------------------
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

let postsData = []; // ← 全投稿データ保存

onSnapshot(q, (snapshot) => {
  postsData = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.createdAt?.toDate) return;
    postsData.push({ id: docSnap.id, ...data });
  });

  renderMonthTags(); // 月一覧更新
});


// --------------------------
// 月タグ生成
// --------------------------
function renderMonthTags() {
  monthTagsDiv.innerHTML = "";
  dayTagsDiv.innerHTML = "";
  postsDiv.innerHTML = "";

  // 月一覧抽出
  const monthMap = {};

  postsData.forEach((p) => {
    const d = p.createdAt.toDate();
    const ym = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!monthMap[ym]) monthMap[ym] = true;
  });

  const months = Object.keys(monthMap).sort().reverse();

  months.forEach((ym) => {
    const [y, m] = ym.split("-");

    const mt = document.createElement("div");
    mt.className = "month-tag";
    mt.textContent = `${y}年${m}月`;

    mt.addEventListener("click", () => {
      document.querySelectorAll(".month-tag").forEach(t => t.classList.remove("active"));
      mt.classList.add("active");
      renderDayTags(ym);
    });

    monthTagsDiv.appendChild(mt);
  });
}


// --------------------------
// 日タグ生成
// --------------------------
function renderDayTags(ym) {
  dayTagsDiv.innerHTML = "";
  postsDiv.innerHTML = "";

  const dayMap = {};

  postsData.forEach((p) => {
    const d = p.createdAt.toDate();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (key !== ym) return;

    const ymd = `${key}-${d.getDate()}`;
    if (!dayMap[ymd]) dayMap[ymd] = true;
  });

  const days = Object.keys(dayMap).sort().reverse();

  days.forEach((ymd) => {
    const day = ymd.split("-")[2];

    const dt = document.createElement("div");
    dt.className = "day-tag";
    dt.textContent = `${day}日`;

    dt.addEventListener("click", () => {
      document.querySelectorAll(".day-tag").forEach(t => t.classList.remove("active"));
      dt.classList.add("active");
      renderPosts(ymd);
    });

    dayTagsDiv.appendChild(dt);
  });
}


// --------------------------
// 投稿一覧表示
// --------------------------
function renderPosts(ymd) {
  postsDiv.innerHTML = "";

  postsData.forEach((post) => {
    const d = post.createdAt.toDate();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    if (key !== ymd) return;

    const card = document.createElement("div");
    card.className = "post";

    card.innerHTML = `
      <div class="name">${escapeHtml(post.name)}</div>
      <div class="time">${d.toLocaleString("ja-JP")}</div>
      <div class="text">${escapeHtml(post.text).replace(/\n/g, "<br>")}</div>
      <button class="deleteBtn" data-id="${post.id}">削除</button>
    `;

    postsDiv.appendChild(card);
  });
}


// --------------------------
// 削除処理
// --------------------------
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("deleteBtn")) {
    const id = e.target.dataset.id;
    if (!confirm("この投稿を削除しますか？")) return;
    await deleteDoc(doc(db, "posts", id));
  }
});


// --------------------------
// 🔔通知（未読バッジ + タイトル点滅）
// --------------------------
const badge = document.getElementById("badge");
let originalTitle = document.title;
let blinkTimer = null;

// 点滅開始
function startBlink() {
  if (blinkTimer) return;
  blinkTimer = setInterval(() => {
    document.title = (document.title === "📩 新着あり！") ? originalTitle : "📩 新着あり！";
  }, 1000);
}

// 点滅停止
function stopBlink() {
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = originalTitle;
}


// Firestore 新着監視
let latestPostTime = null;

onSnapshot(q, (snapshot) => {
  if (snapshot.docs.length > 0) {
    const latest = snapshot.docs[0].data().createdAt?.toDate();

    if (latestPostTime === null) {
      latestPostTime = latest;
    } else {
      if (latest > latestPostTime) {
        showNotification();
        latestPostTime = latest;
      }
    }
  }
});


// 通知を出す
function showNotification() {
  const now = Date.now();
  localStorage.setItem("lastNotification", now);

  badge.style.display = "inline-block";
  startBlink();
}


// ページ読み込み → 1週間以内なら通知継続
window.addEventListener("load", () => {
  const last = localStorage.getItem("lastNotification");
  if (!last) return;

  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - last < oneWeek) {
    badge.style.display = "inline-block";
    startBlink();
  } else {
    localStorage.removeItem("lastNotification");
    stopBlink();
  }
});


// HTMLエスケープ
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
