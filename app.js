import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ---------------------------
// Firebase 初期化
// ---------------------------
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

// ---------------------------
// 投稿（画像つき）
// ---------------------------
document.getElementById("send").addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  const imgFile = imageInput.files[0];

  if (!name || !text) {
    alert("名前と内容を入力してください");
    return;
  }

  let imageUrl = null;

  if (imgFile) {
    const storageRef = ref(storage, "images/" + Date.now() + "_" + imgFile.name);
    await uploadBytes(storageRef, imgFile);
    imageUrl = await getDownloadURL(storageRef);
  }

  await addDoc(postsCol, {
    name,
    text,
    imageUrl,
    parentId: null,
    createdAt: serverTimestamp()
  });

  textInput.value = "";
  imageInput.value = "";
});

// ---------------------------
// 返信投稿
// ---------------------------
async function sendReply(parentId, replyName, replyText) {
  await addDoc(postsCol, {
    name: replyName,
    text: replyText,
    imageUrl: null,
    parentId,
    createdAt: serverTimestamp()
  });
}

// ---------------------------
// 編集
// ---------------------------
async function editPost(postId, newText) {
  await updateDoc(doc(db, "posts", postId), { text: newText });
}

// ---------------------------
// 削除
// ---------------------------
async function deletePostById(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

// ---------------------------
// リアルタイム取得
// ---------------------------
let allPosts = [];

const q = query(postsCol, orderBy("createdAt", "asc"));
onSnapshot(q, (snapshot) => {
  allPosts = [];
  snapshot.forEach(doc => {
    allPosts.push({ id: doc.id, ...doc.data() });
  });

  updateBadge(allPosts);
  renderDateTree(allPosts);
});

// ---------------------------
// 未読 7日
// ---------------------------
function isUnread(post) {
  if (!post.createdAt) return false;
  const now = Date.now();
  const t = post.createdAt.toDate().getTime();
  return now - t < 7 * 86400000;
}

// ---------------------------
// 通知バッジ
// ---------------------------
function updateBadge(posts) {
  const unreadCount = posts.filter(isUnread).length;
  const badge = document.getElementById("badge");

  if (unreadCount > 0) {
    badge.style.display = "inline-block";
    badge.textContent = unreadCount;
    startBlink();
  } else {
    badge.style.display = "none";
    stopBlink();
  }
}

// タイトル点滅
let blinkTimer = null;

function startBlink() {
  if (blinkTimer) return;
  blinkTimer = setInterval(() => {
    document.title =
      document.title.includes("★") ? "掲示板" : "★新着あり★ 掲示板";
  }, 900);
}

function stopBlink() {
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = "掲示板";
}

// ---------------------------
// 日付ツリー生成
// ---------------------------
function renderDateTree(posts) {
  const treeArea = document.getElementById("dateTree");
  treeArea.innerHTML = "";

  const groups = {};

  posts.forEach(p => {
    if (!p.createdAt) return;
    const d = p.createdAt.toDate();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

    groups[y] = groups[y] || {};
    groups[y][m] = groups[y][m] || {};
    groups[y][m][day] = true;
  });

  // ▼ 年 → 月 → 日 で生成
  Object.keys(groups).sort().forEach(y => {
    const yTag = createToggleTag(y + " 年", "year");
    treeArea.appendChild(yTag);

    const mWrap = document.createElement("div");
    mWrap.style.display = "none";
    mWrap.style.marginLeft = "20px";
    treeArea.appendChild(mWrap);

    yTag.onclick = () => {
      mWrap.style.display = mWrap.style.display === "none" ? "block" : "none";
    };

    Object.keys(groups[y]).sort().forEach(m => {
      const mTag = createToggleTag(m + " 月", "month");
      mWrap.appendChild(mTag);

      const dWrap = document.createElement("div");
      dWrap.style.display = "none";
      dWrap.style.marginLeft = "20px";
      mWrap.appendChild(dWrap);

      mTag.onclick = () => {
        dWrap.style.display = dWrap.style.display === "none" ? "block" : "none";
      };

      Object.keys(groups[y][m]).sort().forEach(d => {
        const dTag = createToggleTag(d + " 日", "day");
        dWrap.appendChild(dTag);

        dTag.onclick = () => showPostsOfDate(y, m, d);
      });
    });
  });
}

function createToggleTag(label, cls) {
  const tag = document.createElement("span");
  tag.className = cls;
  tag.textContent = label;
  return tag;
}

// ---------------------------
// 日付クリック → 投稿表示
// ---------------------------
function showPostsOfDate(y, m, d) {
  const list = allPosts.filter(p => {
    if (!p.createdAt) return false;
    const dt = p.createdAt.toDate();
    return (
      dt.getFullYear() == y &&
      dt.getMonth() + 1 == m &&
      dt.getDate() == d
    );
  });

  renderPosts(list);
}

// ---------------------------
// 投稿表示
// ---------------------------
function renderPosts(posts) {
  const area = document.getElementById("posts");
  area.innerHTML = "";

  posts.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";
    if (isUnread(p)) div.classList.add("unread");

    const dt = p.createdAt ? p.createdAt.toDate().toLocaleString() : "";

    div.innerHTML = `
      <b>${p.name}</b>（${dt}）<br>
      <div class="post-text">${p.text}</div>
      ${p.imageUrl ? `<img src="${p.imageUrl}" style="max-width:200px;">` : ""}
      <br><br>

      <button class="replyBtn">返信</button>
      <button class="editBtn">編集</button>
      <button class="deleteBtn">削除</button>

      <div class="replyForm" style="display:none; margin-top:8px;">
        <input type="text" class="replyName" placeholder="名前"><br>
        <textarea class="replyText" rows="3" cols="30" placeholder="返信内容"></textarea><br>
        <button class="sendReply">返信を送信</button>
      </div>
    `;

    // 返信表示
    const children = allPosts.filter(x => x.parentId === p.id);
    children.forEach(c => {
      const r = document.createElement("div");
      r.className = "post replyCard";
      r.innerHTML = `<b>${c.name}</b><br>${c.text}`;
      div.appendChild(r);
    });

    // 返信フォームの動作
    const replyBtn = div.querySelector(".replyBtn");
    const replyForm = div.querySelector(".replyForm");

    replyBtn.onclick = () => {
      replyForm.style.display =
        replyForm.style.display === "none" ? "block" : "none";
    };

    div.querySelector(".sendReply").onclick = () => {
      const rn = div.querySelector(".replyName").value.trim();
      const rt = div.querySelector(".replyText").value.trim();
      if (!rn || !rt) return alert("返信を入力");

      sendReply(p.id, rn, rt);
      replyForm.style.display = "none";
    };

    // 編集
    div.querySelector(".editBtn").onclick = () => {
      const newText = prompt("編集内容を入力", p.text);
      if (newText) editPost(p.id, newText);
    };

    // 削除
    div.querySelector(".deleteBtn").onclick = () => {
      if (confirm("削除しますか？")) deletePostById(p.id);
    };

    area.appendChild(div);
  });
}
