// ==============================
// Firebase SDK 読み込み
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const storage = getStorage(app);

// HTML要素
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const imageInput = document.getElementById("image");
const sendBtn = document.getElementById("send");
const postsDiv = document.getElementById("posts");

// 通知要素
const badge = document.getElementById("badge");
let originalTitle = document.title;
let blinkTimer = null;

// 未読保持期間：7日
const UNREAD_LIMIT = 7 * 24 * 60 * 60 * 1000;


// ==============================
// 🔔 タイトル点滅
// ==============================
function startBlink() {
  if (blinkTimer) return;
  blinkTimer = setInterval(() => {
    document.title = document.title === "★新着あり★" ? originalTitle : "★新着あり★";
  }, 800);
}

function stopBlink() {
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = originalTitle;
}


// ==============================
// 🔔 バッジ更新
// ==============================
function updateBadge(count) {
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}


// ==============================
// 📤 新規投稿（画像付き）
// ==============================
sendBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim() || "名無し";
  const text = textInput.value.trim();
  if (!text && !imageInput.files.length) return;

  let imageUrl = "";

  // 画像があれば Storage へアップロード
  if (imageInput.files.length > 0) {
    const file = imageInput.files[0];
    const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    imageUrl = await getDownloadURL(storageRef);
  }

  // Firestore へ投稿
  await addDoc(collection(db, "posts"), {
    name,
    text,
    imageUrl,
    createdAt: serverTimestamp()
  });

  textInput.value = "";
  imageInput.value = "";
});


// ==============================
// 📥 Firestore から投稿を取得（リアルタイム）
// ==============================
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  postsDiv.innerHTML = "";

  const now = Date.now();

  // 7日以内の未読だけ数える
  let unreadCount = 0;

  // 年 → 月 → 日 → 投稿 の階層構造
  const tree = {};

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.createdAt?.toDate) return;

    const date = data.createdAt.toDate();
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();

    const yKey = `${y}`;
    const mKey = `${y}-${m}`;
    const dKey = `${y}-${m}-${d}`;

    if (!tree[yKey]) tree[yKey] = {};
    if (!tree[yKey][mKey]) tree[yKey][mKey] = {};
    if (!tree[yKey][mKey][dKey]) tree[yKey][mKey][dKey] = [];

    tree[yKey][mKey][dKey].push({
      id: docSnap.id,
      ...data
    });
  });

  // -----------------------------
  // 年 → 月 → 日 とツリー生成
  // -----------------------------
  for (const year in tree) {
    const yearBox = document.createElement("div");
    yearBox.className = "year-box";

    const yLabel = document.createElement("div");
    yLabel.className = "year-tag";
    yLabel.textContent = `${year}年`;

    yearBox.appendChild(yLabel);

    // 月
    for (const month in tree[year]) {
      const monthTag = document.createElement("div");
      monthTag.className = "month-tag";
      monthTag.textContent = month.replace(`${year}-`, "") + "月";

      const monthChild = document.createElement("div");
      monthChild.className = "month-child";
      monthChild.style.display = "none";

      monthTag.addEventListener("click", () => {
        monthChild.style.display =
          monthChild.style.display === "none" ? "block" : "none";
      });

      yearBox.appendChild(monthTag);
      yearBox.appendChild(monthChild);

      // 日
      for (const day in tree[year][month]) {
        const dayTag = document.createElement("div");
        dayTag.className = "day-tag";
        dayTag.textContent = day.split("-")[2] + "日";

        const dayChild = document.createElement("div");
        dayChild.className = "day-child";
        dayChild.style.display = "none";

        dayTag.addEventListener("click", () => {
          dayChild.style.display =
            dayChild.style.display === "none" ? "block" : "none";
        });

        monthChild.appendChild(dayTag);
        monthChild.appendChild(dayChild);

        // 投稿
        tree[year][month][day].forEach(post => {
          const time = post.createdAt.toDate().toLocaleString("ja-JP");

          const card = document.createElement("div");
          card.className = "post";

          // 未読判定（7日以内）
          const diff = now - post.createdAt.toDate().getTime();
          if (diff < UNREAD_LIMIT) {
            card.classList.add("unread");
            unreadCount++;
          }

          card.innerHTML = `
            <div><strong>${escapeHtml(post.name)}</strong>（${escapeHtml(time)}）</div>
            <div class="post-text">${escapeHtml(post.text)}</div>
            ${post.imageUrl ? `<img src="${post.imageUrl}" style="max-width:200px;margin-top:5px;border-radius:4px;">` : ""}
            <button class="deleteBtn" data-id="${post.id}">削除</button>
          `;

          dayChild.appendChild(card);
        });
      }
    }

    postsDiv.appendChild(yearBox);
  }

  // バッジ更新
  updateBadge(unreadCount);

  // 未読があれば点滅
  if (unreadCount > 0) startBlink();
  else stopBlink();
});


// ==============================
// ❌ 削除
// ==============================
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("deleteBtn")) return;

  if (!confirm("削除しますか？")) return;

  const id = e.target.dataset.id;
  await deleteDoc(doc(db, "posts", id));
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
