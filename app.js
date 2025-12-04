// app.js (ES module)
// Firebase v10.8.0 imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- Firebase 設定（既存の値を使用） ---
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
const postsCol = collection(db, "posts");

// DOM
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const imageInput = document.getElementById("image");
const sendBtn = document.getElementById("send");
const dateTree = document.getElementById("dateTree");
const postsArea = document.getElementById("posts");
const badgeEl = document.getElementById("badge");
const notificationBtn = document.getElementById("notificationBtn");

// Unread window (7 days)
const UNREAD_MS = 7 * 24 * 60 * 60 * 1000;

// Title blink
let blinkTimer = null;
const ORIGINAL_TITLE = document.title || "掲示板";
function startBlink() {
  if (blinkTimer) return;
  let flag = false;
  blinkTimer = setInterval(() => {
    document.title = flag ? ORIGINAL_TITLE : "★新着あり★ 掲示板";
    flag = !flag;
  }, 900);
}
function stopBlink() {
  if (!blinkTimer) return;
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = ORIGINAL_TITLE;
}

// util: convert createdAt to Date()
function toDate(createdAt) {
  if (!createdAt) return null;
  if (typeof createdAt.toDate === "function") return createdAt.toDate();
  const n = Number(createdAt);
  if (!Number.isNaN(n)) return new Date(n);
  return null;
}

// ------------------
// 投稿（画像アップ対応）
// ------------------
sendBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "名無し").trim();
  const text = (textInput.value || "").trim();
  const file = imageInput.files?.[0];

  if (!text && !file) {
    alert("投稿内容か画像を入力してください。");
    return;
  }

  sendBtn.disabled = true;
  try {
    let imageUrl = "";
    if (file) {
      const key = `images/${Date.now()}_${file.name}`;
      const r = ref(storage, key);
      await uploadBytes(r, file);
      imageUrl = await getDownloadURL(r);
    }

    await addDoc(postsCol, {
      name,
      text,
      imageUrl: imageUrl || "",
      parentId: null,
      createdAt: serverTimestamp()
    });

    // clear
    textInput.value = "";
    imageInput.value = "";
  } catch (e) {
    console.error("投稿エラー:", e);
    alert("投稿に失敗しました。Consoleを確認してください。");
  } finally {
    sendBtn.disabled = false;
  }
});

// ------------------
// 返信 / 編集 / 削除 helpers
// ------------------
async function sendReply(parentId, replyName, replyText) {
  if (!replyText) return;
  await addDoc(postsCol, {
    name: replyName || "名無し",
    text: replyText,
    imageUrl: "",
    parentId,
    createdAt: serverTimestamp()
  });
}
async function editPost(postId, newText) {
  await updateDoc(doc(db, "posts", postId), { text: newText });
}
async function deletePostById(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

// ------------------
// リアルタイム監視（posts）
// ------------------
let allPosts = [];
const q = query(postsCol, orderBy("createdAt", "asc"));
onSnapshot(q, (snap) => {
  allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // update badge & title
  updateBadge(allPosts);
  // render tree
  renderDateTree(allPosts);
});

// ------------------
// 未読判定
// ------------------
function isUnread(post) {
  const dt = toDate(post.createdAt);
  if (!dt) return false;
  return (Date.now() - dt.getTime()) < UNREAD_MS;
}

// ------------------
// badge update
// ------------------
function updateBadge(posts) {
  const unreadCount = posts.filter(isUnread).length;
  if (unreadCount > 0) {
    badgeEl.style.display = "inline-block";
    badgeEl.textContent = unreadCount;
    startBlink();
  } else {
    badgeEl.style.display = "none";
    stopBlink();
  }
}

// ------------------
// ツリー作成（年→月→日）
// JS が自動で年タグを作る（HTML 側に year は不要）
// ------------------
function renderDateTree(posts) {
  // build groups
  const groups = {};
  posts.forEach(p => {
    const dt = toDate(p.createdAt);
    if (!dt) return;
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    groups[y] = groups[y] || {};
    groups[y][m] = groups[y][m] || {};
    groups[y][m][d] = groups[y][m][d] || [];
    groups[y][m][d].push(p);
  });

  // render
  dateTree.innerHTML = "";

  // Add notification area above tree (already in HTML header) — no-op here.
  // Build year blocks (sorted desc)
  const years = Object.keys(groups).sort((a,b)=>Number(b)-Number(a));
  years.forEach(year => {
    const yearWrap = document.createElement("div");
    yearWrap.className = "year-wrap";

    // year tag
    const yTag = document.createElement("span");
    yTag.className = "year-tag";
    yTag.textContent = `${year}年`;
    yTag.style.cursor = "pointer";
    yearWrap.appendChild(yTag);

    // month container (initially hidden)
    const monthList = document.createElement("div");
    monthList.className = "month-list";
    monthList.style.display = "none";
    yearWrap.appendChild(monthList);

    yTag.addEventListener("click", () => {
      monthList.style.display = monthList.style.display === "none" ? "block" : "none";
    });

    // months sorted desc
    const months = Object.keys(groups[year]).sort((a,b)=>Number(b)-Number(a));
    months.forEach(m => {
      const mTag = document.createElement("div");
      mTag.className = "month-tag";
      mTag.textContent = `${m}月`;
      mTag.style.cursor = "pointer";
      monthList.appendChild(mTag);

      const dayList = document.createElement("div");
      dayList.className = "day-list";
      dayList.style.display = "none";
      monthList.appendChild(dayList);

      mTag.addEventListener("click", () => {
        dayList.style.display = dayList.style.display === "none" ? "block" : "none";
      });

      // days sorted desc
      const days = Object.keys(groups[year][m]).sort((a,b)=>Number(b)-Number(a));
      days.forEach(d => {
        const dTag = document.createElement("div");
        dTag.className = "day-tag";
        dTag.textContent = `${d}日`;
        dTag.style.cursor = "pointer";
        dayList.appendChild(dTag);

        dTag.addEventListener("click", () => {
          showPostsOfDate(Number(year), Number(m), Number(d));
        });
      });
    });

    dateTree.appendChild(yearWrap);
  });
}

// ------------------
// 日付クリック → 投稿表示
// ------------------
function showPostsOfDate(y,m,d) {
  const list = allPosts.filter(p => {
    const dt = toDate(p.createdAt);
    if (!dt) return false;
    return dt.getFullYear() === y && dt.getMonth()+1 === m && dt.getDate() === d;
  });

  renderPosts(list);
}

// ------------------
// 投稿レンダー（根投稿＋返信）
// ------------------
function renderPosts(posts) {
  postsArea.innerHTML = "";
  posts.forEach(p => {
    const el = document.createElement("div");
    el.className = "post";
    if (isUnread(p)) el.classList.add("unread");

    const dt = toDate(p.createdAt);
    const dtText = dt ? dt.toLocaleString() : "";

    el.innerHTML = `
      <div><strong>${escapeHtml(p.name || "名無し")}</strong>　<span style="color:#777;font-size:12px">${escapeHtml(dtText)}</span></div>
      <div class="post-text">${escapeHtml(p.text || "")}</div>
      ${p.imageUrl ? `<div><img src="${escapeHtml(p.imageUrl)}" alt="img"></div>` : ""}
      <div style="margin-top:8px">
        <button class="replyBtn">返信</button>
        <button class="editBtn">編集</button>
        <button class="deleteBtn">削除</button>
      </div>

      <div class="replyForm" style="display:none; margin-top:8px;">
        <input class="replyName" placeholder="名前"><br>
        <textarea class="replyText" rows="3" cols="40" placeholder="返信内容"></textarea><br>
        <button class="sendReply">返信を送信</button>
      </div>
    `;

    // replies for this post (same collection)
    const replies = allPosts.filter(x => x.parentId === p.id).sort((a,b)=>{
      const ta = toDate(a.createdAt)?.getTime() || 0;
      const tb = toDate(b.createdAt)?.getTime() || 0;
      return ta - tb;
    });
    replies.forEach(r => {
      const rEl = document.createElement("div");
      rEl.className = "post";
      rEl.style.marginLeft = "18px";
      rEl.style.background = "#fafafa";
      const rDt = toDate(r.createdAt);
      rEl.innerHTML = `<div><strong>${escapeHtml(r.name)}</strong> <span style="color:#666;font-size:12px">${escapeHtml(rDt ? rDt.toLocaleString() : "")}</span></div>
        <div class="post-text">${escapeHtml(r.text)}</div>`;
      el.appendChild(rEl);
    });

    // handlers
    const replyBtn = el.querySelector(".replyBtn");
    const replyForm = el.querySelector(".replyForm");
    replyBtn.addEventListener("click", () => {
      replyForm.style.display = replyForm.style.display === "none" ? "block" : "none";
    });
    el.querySelector(".sendReply").addEventListener("click", async () => {
      const rn = replyForm.querySelector(".replyName").value.trim() || "名無し";
      const rt = replyForm.querySelector(".replyText").value.trim();
      if (!rt) return alert("返信を入力してください");
      await sendReply(p.id, rn, rt);
      replyForm.querySelector(".replyName").value = "";
      replyForm.querySelector(".replyText").value = "";
      replyForm.style.display = "none";
    });

    el.querySelector(".editBtn").addEventListener("click", async () => {
      const newText = prompt("編集内容を入力", p.text);
      if (!newText) return;
      await editPost(p.id, newText);
    });

    el.querySelector(".deleteBtn").addEventListener("click", async () => {
      if (!confirm("削除しますか？")) return;
      await deletePostById(p.id);
    });

    postsArea.appendChild(el);
  });
}

// simple html escape
function escapeHtml(s=""){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
}

// optional: click notification button clears badge in UI (but unread logic remains 7-day)
// clicking acknowledges
notificationBtn.addEventListener("click", ()=> {
  // clear visual badge and stop blinking (but unread flags remain per posts)
  badgeEl.style.display = "none";
  stopBlink();
});
