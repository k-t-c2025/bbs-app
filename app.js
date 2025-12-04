// ===============================
// Firebase 初期化
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, orderBy, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ★ あなたの Firebase 情報に必ず書き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyC10ERewIkpD_ZjQPneF3hWyunEKwBMCAQ",
  authDomain: "keijibann-b44b8.firebaseapp.com",
  projectId: "keijibann-b44b8",
  storageBucket: "keijibann-b44b8.firebasestorage.app",
  messagingSenderId: "267259675864",
  appId: "1:267259675864:web:971536e4f188051db5c3ad",
  measurementId: "G-WW1ZETJDN8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const POSTS_COL = collection(db, "posts");
const UNREAD_MS = 7 * 24 * 60 * 60 * 1000;

// ===============================
// DOM
// ===============================
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const imageInput = document.getElementById("image");
const sendBtn = document.getElementById("send");

const yearTagsDiv = document.getElementById("yearTags");
const monthTagsDiv = document.getElementById("monthTags");
const dayTagsDiv = document.getElementById("dayTags");
const postsDiv = document.getElementById("posts");
const badge = document.getElementById("badge");

let blinkTimer = null;
const ORIGINAL_TITLE = document.title;

// ===============================
// タイトル点滅
// ===============================
function startBlink() {
  if (blinkTimer) return;
  let f = false;
  blinkTimer = setInterval(() => {
    document.title = f ? ORIGINAL_TITLE : "★新着あり★ 掲示板";
    f = !f;
  }, 800);
}
function stopBlink() {
  if (!blinkTimer) return;
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = ORIGINAL_TITLE;
}

// ===============================
// Utility
// ===============================
function escapeHtml(str="") {
  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function createdAtToDate(c) {
  if (!c) return null;
  if (typeof c.toDate === "function") return c.toDate();
  return new Date(c);
}

function isUnread(post) {
  const d = createdAtToDate(post.createdAt);
  if (!d) return false;
  return (Date.now() - d.getTime()) < UNREAD_MS;
}

// ===============================
// Image Upload
// ===============================
async function uploadImage(file) {
  if (!file) return "";
  const r = ref(storage, "images/" + Date.now() + "_" + file.name);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

// ===============================
// 投稿（送信）
// ===============================
sendBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim() || "名無し";
  const text = textInput.value.trim();
  const file = imageInput.files[0];

  if (!text && !file) {
    alert("本文か画像を入力してください");
    return;
  }

  sendBtn.disabled = true;
  try {
    let imageUrl = "";
    if (file) imageUrl = await uploadImage(file);

    await addDoc(POSTS_COL, {
      name,
      text,
      imageUrl,
      parentId: null,
      createdAt: serverTimestamp()
    });

    textInput.value = "";
    imageInput.value = "";

  } catch (e) {
    console.error(e);
    alert("投稿エラー");
  }
  sendBtn.disabled = false;
});

// ===============================
// ツリー構築（年→月→日）
// ===============================
function buildTree(posts) {
  const tree = {};
  posts.forEach(p => {
    const d = createdAtToDate(p.createdAt);
    if (!d) return;

    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");

    const mkey = `${y}-${m}`;
    const dkey = `${mkey}-${day}`;

    if (!tree[y]) tree[y] = {};
    if (!tree[y][mkey]) tree[y][mkey] = {};
    if (!tree[y][mkey][dkey]) tree[y][mkey][dkey] = [];

    tree[y][mkey][dkey].push(p);
  });
  return tree;
}

// ===============================
// ツリー描画
// ===============================
function renderTree(tree) {
  yearTagsDiv.innerHTML = "";
  monthTagsDiv.innerHTML = "";
  dayTagsDiv.innerHTML = "";
  postsDiv.innerHTML = "";

  Object.keys(tree).sort((a,b)=>b-a).forEach(year => {
    const b = document.createElement("button");
    b.textContent = `${year}年`;
    b.addEventListener("click", ()=> renderMonths(tree[year], year));
    yearTagsDiv.appendChild(b);
  });
}

function renderMonths(monthData, year) {
  monthTagsDiv.innerHTML = "";
  dayTagsDiv.innerHTML = "";
  postsDiv.innerHTML = "";

  Object.keys(monthData)
    .sort((a,b)=>Number(b.split("-")[1]) - Number(a.split("-")[1]))
    .forEach(mkey => {
      const b = document.createElement("button");
      b.textContent = `${mkey.split("-")[1]}月`;
      b.addEventListener("click", ()=> renderDays(monthData[mkey], mkey));
      monthTagsDiv.appendChild(b);
    });
}

function renderDays(dayData, mkey) {
  dayTagsDiv.innerHTML = "";
  postsDiv.innerHTML = "";

  Object.keys(dayData)
    .sort((a,b)=>Number(b.split("-")[2]) - Number(a.split("-")[2]))
    .forEach(dkey => {
      const b = document.createElement("button");
      b.textContent = `${dkey.split("-")[2]}日`;
      b.addEventListener("click", ()=> showPostsForDay(dayData[dkey], dkey));
      dayTagsDiv.appendChild(b);
    });
}

// ===============================
// 投稿描画
// ===============================
function showPostsForDay(posts, dkey) {
  postsDiv.innerHTML = "";
  postsDiv.setAttribute("data-day", dkey);

  const roots = posts.filter(p => !p.parentId);

  roots.sort((a,b)=>{
    return createdAtToDate(b.createdAt) - createdAtToDate(a.createdAt);
  });

  roots.forEach(p => {
    postsDiv.appendChild(makePostCard(p, posts));
  });
}

// ===============================
// 投稿カード生成
// ===============================
function makePostCard(post, allPosts) {
  const card = document.createElement("div");
  card.className = "post";
  if (isUnread(post)) card.classList.add("unread");

  const d = createdAtToDate(post.createdAt);
  const dateStr = d ? d.toLocaleString() : "";

  card.innerHTML = `
    <strong>${escapeHtml(post.name)}</strong> (${dateStr})<br>
    <div class="post-text">${escapeHtml(post.text).replace(/\n/g,"<br>")}</div>
    ${post.imageUrl ? `<img src="${post.imageUrl}" style="max-width:300px;margin-top:8px;">` : ""}
    <div class="ctrl" style="margin-top:10px;">
      <button class="reply-btn">返信</button>
      <button class="edit-btn">編集</button>
      <button class="delete-btn">削除</button>
    </div>
  `;

  // --- 返信フォーム ---
  const replyForm = document.createElement("div");
  replyForm.style.display = "none";
  replyForm.innerHTML = `
    <input class="reply-name" placeholder="名前"><br>
    <textarea class="reply-text" rows="3" cols="20" placeholder="返信内容"></textarea><br>
    <button class="reply-send">返信送信</button>
  `;
  card.appendChild(replyForm);

  // 返信
  card.querySelector(".reply-btn").onclick = () => {
    replyForm.style.display = (replyForm.style.display==="none") ? "block" : "none";
  };

  card.querySelector(".reply-send").onclick = async () => {
    const n = replyForm.querySelector(".reply-name").value.trim() || "名無し";
    const t = replyForm.querySelector(".reply-text").value.trim();
    if (!t) return alert("返信内容を入力してください");
    await addDoc(POSTS_COL, {
      name:n, text:t, imageUrl:"",
      parentId:post.id,
      createdAt: serverTimestamp()
    });
  };

  // 編集
  card.querySelector(".edit-btn").onclick = async () => {
    const nt = prompt("編集内容を入力", post.text);
    if (nt === null) return;
    await updateDoc(doc(db,"posts",post.id), { text:nt });
  };

  // 削除
  card.querySelector(".delete-btn").onclick = async () => {
    if (!confirm("削除しますか？")) return;
    await deleteDoc(doc(db,"posts",post.id));
  };

  // --- 返信一覧 ---
  const replies = allPosts.filter(p => p.parentId === post.id);
  replies.sort((a,b)=>createdAtToDate(a.createdAt)-createdAtToDate(b.createdAt));
  replies.forEach(r => {
    const rd = document.createElement("div");
    rd.className = "post reply";

    const d2 = createdAtToDate(r.createdAt);
    rd.innerHTML = `
      <strong>${escapeHtml(r.name)}</strong> (${d2.toLocaleString()})<br>
      <div>${escapeHtml(r.text)}</div>
      <button class="re-edit">編集</button>
      <button class="re-del">削除</button>
    `;

    // 返信編集
    rd.querySelector(".re-edit").onclick = async () => {
      const nt = prompt("返信を編集", r.text);
      if (nt === null) return;
      await updateDoc(doc(db,"posts",r.id), { text:nt });
    };

    // 返信削除
    rd.querySelector(".re-del").onclick = async () => {
      if (!confirm("返信を削除しますか？")) return;
      await deleteDoc(doc(db,"posts",r.id));
    };

    card.appendChild(rd);
  });

  return card;
}

// ===============================
// 未読バッジ更新
// ===============================
function updateBadge(posts) {
  const cnt = posts.filter(isUnread).length;
  if (cnt > 0) {
    badge.style.display = "inline-block";
    badge.textContent = cnt;
    startBlink();
  } else {
    badge.style.display = "none";
    stopBlink();
  }
}

// ===============================
// Firestore リアルタイム監視
// ===============================
onSnapshot(query(POSTS_COL, orderBy("createdAt","asc")), snap => {
  const posts = snap.docs.map(d => ({id:d.id, ...d.data()}));
  const tree = buildTree(posts);
  renderTree(tree);
  updateBadge(posts);
});
