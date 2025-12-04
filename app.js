// ==========================================================
// Firebase 読み込み
// ==========================================================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, doc, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ==========================================================
// Firebase 初期化
// ==========================================================
const firebaseConfig = {
  // ★ Firebase 設定をここへ貼ってください ★
  apiKey: "AIzaSyC10ERewIkpD_ZjQPneF3hWyunEKwBMCAQ",
  authDomain: "keijibann-b44b8.firebaseapp.com",
  projectId: "keijibann-b44b8",
  storageBucket: "keijibann-b44b8.firebasestorage.app",
  messagingSenderId: "267259675864",
  appId: "1:267259675864:web:971536e4f188051db5c3ad",
  measurementId: "G-WW1ZETJDN8"
};

initializeApp(firebaseConfig);
const db = getFirestore();
const storage = getStorage();
const postsCol = collection(db, "posts");


// ==========================================================
// 投稿送信
// ==========================================================
document.getElementById("send").addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const text = document.getElementById("text").value.trim();
  const imageFile = document.getElementById("image").files[0];

  if (!name || !text) {
    alert("名前と内容を入力してください");
    return;
  }

  let imageUrl = null;

  // 画像を Storage にアップロード
  if (imageFile) {
    const storageRef = ref(storage, "images/" + Date.now() + "_" + imageFile.name);
    await uploadBytes(storageRef, imageFile);
    imageUrl = await getDownloadURL(storageRef);
  }

  await addDoc(postsCol, {
    name,
    text,
    imageUrl,
    parentId: null,
    createdAt: serverTimestamp()
  });

  document.getElementById("text").value = "";
  document.getElementById("image").value = "";
});


// ==========================================================
// Firestore リアルタイム取得
// ==========================================================
const q = query(postsCol, orderBy("createdAt", "asc"));

onSnapshot(q, (snapshot) => {
  const posts = [];
  snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));

  renderDateTree(posts);
  renderPosts(posts);
  updateBadge(posts);
});


// ==========================================================
// 未読判定（7日以内）
// ==========================================================
function isUnread(post) {
  if (!post.createdAt) return false;

  const now = Date.now();
  const t = post.createdAt.toDate().getTime();
  return now - t < 7 * 24 * 60 * 60 * 1000;
}


// ==========================================================
// バッジ（未読数）
// ==========================================================
let blinkTimer = null;

function updateBadge(posts) {
  const unreadCount = posts.filter(isUnread).length;
  const badge = document.getElementById("badge");

  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = "inline-block";
    startBlink();
  } else {
    badge.style.display = "none";
    stopBlink();
  }
}

function startBlink() {
  if (blinkTimer) return;
  blinkTimer = setInterval(() => {
    document.title = document.title.includes("★")
      ? "掲示板"
      : "★新着あり★ 掲示板";
  }, 900);
}

function stopBlink() {
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = "掲示板";
}


// ==========================================================
// 年 → 月 → 日 ツリー
// ==========================================================
function renderDateTree(posts) {
  const years = {};

  posts.forEach(p => {
    if (!p.createdAt) return;
    const d = p.createdAt.toDate();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    years[y] ??= {};
    years[y][m] ??= {};
    years[y][m][day] ??= [];
    years[y][m][day].push(p);
  });

  const yearBox = document.getElementById("yearTags");
  yearBox.innerHTML = "";

  Object.keys(years).forEach(year => {
    const tag = document.createElement("div");
    tag.className = "year-tag";
    tag.textContent = year;

    tag.addEventListener("click", () => renderMonthTags(years[year], year));
    yearBox.appendChild(tag);
  });
}

function renderMonthTags(monthData, year) {
  const box = document.getElementById("monthTags");
  box.innerHTML = "";

  Object.keys(monthData).forEach(m => {
    const tag = document.createElement("div");
    tag.className = "month-tag";
    tag.textContent = `${year}年 ${m}月`;

    tag.addEventListener("click", () => renderDayTags(monthData[m], year, m));
    box.appendChild(tag);
  });
}

function renderDayTags(dayData, year, month) {
  const box = document.getElementById("dayTags");
  box.innerHTML = "";

  Object.keys(dayData).forEach(day => {
    const tag = document.createElement("div");
    tag.className = "day-tag";
    tag.textContent = `${month}月${day}日`;

    tag.addEventListener("click", () => renderPosts(dayData[day]));
    box.appendChild(tag);
  });
}


// ==========================================================
// 投稿をリスト表示（返信ツリー）
// ==========================================================
function renderPosts(posts) {
  const box = document.getElementById("posts");
  box.innerHTML = "";

  const roots = posts.filter(p => !p.parentId);
  const replies = posts.filter(p => p.parentId);

  roots.forEach(post => {
    box.appendChild(createPostCard(post));

    replies
      .filter(r => r.parentId === post.id)
      .forEach(reply => box.appendChild(createPostCard(reply, true)));
  });
}


// ==========================================================
// 投稿カード（削除・編集付き）
// ==========================================================
function createPostCard(post, isReply = false) {
  const div = document.createElement("div");
  div.className = "post";
  if (isReply) div.classList.add("reply");

  if (isUnread(post)) div.classList.add("unread");

  const date = post.createdAt
    ? post.createdAt.toDate().toLocaleString()
    : "日時なし";

  div.innerHTML = `
    <b>${post.name}</b>（${date}）<br>
    <div class="post-text">${post.text}</div>
    ${post.imageUrl ? `<img src="${post.imageUrl}" style="max-width:200px;">` : ""}

    <div style="margin-top:8px;">
      <button class="replyBtn">返信</button>
      <button class="editBtn">編集</button>
      <button class="deleteBtn">削除</button>
    </div>

    <!-- 返信フォーム -->
    <div class="replyForm" style="display:none; margin-top:6px;">
      <input type="text" class="replyName" placeholder="名前"><br>
      <textarea class="replyText" rows="3" cols="20" placeholder="返信内容"></textarea><br>
      <button class="sendReply">返信を送信</button>
    </div>

    <!-- 編集フォーム -->
    <div class="editForm" style="display:none; margin-top:6px;">
      <textarea class="editText" rows="3" cols="25">${post.text}</textarea><br>
      <button class="saveEdit">保存</button>
      <button class="cancelEdit">キャンセル</button>
    </div>
  `;

  // =========================
  // 返信フォーム
  // =========================
  const replyBtn = div.querySelector(".replyBtn");
  const replyForm = div.querySelector(".replyForm");
  replyBtn.addEventListener("click", () => {
    replyForm.style.display =
      replyForm.style.display === "none" ? "block" : "none";
  });

  div.querySelector(".sendReply").addEventListener("click", async () => {
    const replyName = div.querySelector(".replyName").value.trim();
    const replyText = div.querySelector(".replyText").value.trim();

    if (!replyName || !replyText) {
      alert("返信の名前・内容を入力してください");
      return;
    }

    await addDoc(postsCol, {
      name: replyName,
      text: replyText,
      parentId: post.id,
      imageUrl: null,
      createdAt: serverTimestamp()
    });

    replyForm.style.display = "none";
  });

  // =========================
  // 編集フォーム
  // =========================
  const editBtn = div.querySelector(".editBtn");
  const editForm = div.querySelector(".editForm");
  const postText = div.querySelector(".post-text");

  editBtn.addEventListener("click", () => {
    editForm.style.display =
      editForm.style.display === "none" ? "block" : "none";
  });

  div.querySelector(".saveEdit").addEventListener("click", async () => {
    const newText = div.querySelector(".editText").value.trim();
    if (!newText) {
      alert("内容を入力してください");
      return;
    }

    await updateDoc(doc(db, "posts", post.id), { text: newText });

    postText.textContent = newText;
    editForm.style.display = "none";
  });

  div.querySelector(".cancelEdit").addEventListener("click", () => {
    editForm.style.display = "none";
  });

  // =========================
  // 削除
  // =========================
  const deleteBtn = div.querySelector(".deleteBtn");

  deleteBtn.addEventListener("click", async () => {
    if (!confirm("本当に削除しますか？")) return;

    await deleteDoc(doc(db, "posts", post.id));
  });

  return div;
}
