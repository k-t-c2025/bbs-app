// app.js（完全版）
// -----------------
// 必ず firebaseConfig をあなたの値に書き換えてください

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// --- Firebase 設定（ここを書き換えてください） ---
const firebaseConfig = {
  apiKey: "AIzaSyC10ERewIkpD_ZjQPneF3hWyunEKwBMCAQ",
  authDomain: "keijibann-b44b8.firebaseapp.com",
  projectId: "keijibann-b44b8",
  storageBucket: "keijibann-b44b8.firebasestorage.app",
  messagingSenderId: "267259675864",
  appId: "1:267259675864:web:971536e4f188051db5c3ad",
  measurementId: "G-WW1ZETJDN8"
};

// 初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const imageInput = document.getElementById("image");
const sendBtn = document.getElementById("send");
const postsDiv = document.getElementById("posts");
const yearTagsDiv = document.getElementById("yearTags");
const monthTagsDiv = document.getElementById("monthTags");
const dayTagsDiv = document.getElementById("dayTags");
const badge = document.getElementById("badge");

// 定数
const UNREAD_LIMIT = 7 * 24 * 60 * 60 * 1000; // 7日
const postsCol = collection(db, "posts");

// タイトル点滅
let blinkTimer = null;
const originalTitle = document.title || "掲示板";
function startTitleBlink() {
  if (blinkTimer) return;
  let flag = false;
  blinkTimer = setInterval(() => {
    document.title = flag ? originalTitle : "★新着あり★ 掲示板";
    flag = !flag;
  }, 800);
}
function stopTitleBlink() {
  if (!blinkTimer) return;
  clearInterval(blinkTimer);
  blinkTimer = null;
  document.title = originalTitle;
}

// helpers
function escapeHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function pad(n){ return ("0"+n).slice(-2); }
function yKey(d){ return `${d.getFullYear()}`; }
function mKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
function dKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function isUnread(createdAt){
  if (!createdAt || typeof createdAt.toDate !== "function") return false;
  return (Date.now() - createdAt.toDate().getTime()) < UNREAD_LIMIT;
}

// テキストエリア幅指定（cols/rows）
try {
  if (textInput) { textInput.setAttribute("cols","20"); textInput.setAttribute("rows","5"); }
} catch(e){}

// 画像アップロード
async function uploadImage(file){
  if (!file) return "";
  const r = ref(storage, `images/${Date.now()}_${file.name}`);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

// 投稿送信（画像対応）
sendBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "名無し").trim();
  const text = (textInput.value || "").trim();

  if (!text && (!imageInput || !imageInput.files || imageInput.files.length===0)) {
    alert("投稿内容または画像を入力してください");
    return;
  }

  sendBtn.disabled = true;
  try {
    let imageUrl = "";
    if (imageInput && imageInput.files && imageInput.files[0]) {
      imageUrl = await uploadImage(imageInput.files[0]);
    }

    await addDoc(postsCol, {
      name,
      text,
      imageUrl,
      parentId: null,
      createdAt: serverTimestamp()
    });

    textInput.value = "";
    if (imageInput) imageInput.value = "";
  } catch(err){
    console.error("投稿エラー", err);
    alert("投稿に失敗しました（コンソール参照）");
  } finally {
    sendBtn.disabled = false;
  }
});

// 返信を送信する（親ID指定）
async function sendReply(parentId, replyName, replyText){
  await addDoc(postsCol, {
    name: replyName || "名無し",
    text: replyText,
    imageUrl: "",
    parentId,
    createdAt: serverTimestamp()
  });
}

// Firestore から取得（安定の昇順）
const q = query(postsCol, orderBy("createdAt", "asc"));

// onSnapshot は常に1回だけ登録
onSnapshot(q, (snap) => {
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // build tree
  const tree = {}; // { year: { monthKey: { dayKey: [posts...] } } }
  let unreadCount = 0;

  docs.forEach(p => {
    if (!p.createdAt || typeof p.createdAt.toDate !== "function") return;
    const dt = p.createdAt.toDate();
    const y = yKey(dt), m = mKey(dt), d = dKey(dt);
    if (!tree[y]) tree[y] = {};
    if (!tree[y][m]) tree[y][m] = {};
    if (!tree[y][m][d]) tree[y][m][d] = [];
    tree[y][m][d].push(p);

    if (isUnread(p.createdAt)) unreadCount++;
  });

  // バッジ・点滅更新
  if (unreadCount>0) { badge.style.display="inline-block"; badge.textContent = unreadCount; startTitleBlink(); }
  else { badge.style.display="none"; badge.textContent=""; stopTitleBlink(); }

  // render tree
  renderTree(tree);
});

// render tree -> year -> month -> day (day toggles posts)
function renderTree(tree){
  yearTagsDiv?.replaceChildren();
  monthTagsDiv?.replaceChildren();
  dayTagsDiv?.replaceChildren();
  postsDiv.innerHTML = "";

  // years desc
  const years = Object.keys(tree).sort((a,b)=>b.localeCompare(a));
  years.forEach(year=>{
    const yearBtn = document.createElement("button");
    yearBtn.className = "year-btn";
    yearBtn.textContent = `${year}年`;
    yearBtn.addEventListener("click", ()=>{
      // when year clicked, show months in monthTagsDiv
      monthTagsDiv.innerHTML = "";
      dayTagsDiv.innerHTML = "";
      postsDiv.innerHTML = "";
      const months = Object.keys(tree[year]).sort((a,b)=> b.localeCompare(a));
      months.forEach(mk=>{
        const monthBtn = document.createElement("button");
        monthBtn.className = "month-btn";
        const monthLabel = mk.split("-")[1];
        monthBtn.textContent = `${monthLabel}月`;
        monthBtn.addEventListener("click", ()=>{
          // show days
          dayTagsDiv.innerHTML = "";
          postsDiv.innerHTML = "";
          const days = Object.keys(tree[year][mk]).sort((a,b)=> b.localeCompare(a));
          days.forEach(dk=>{
            const dayBtn = document.createElement("button");
            dayBtn.className = "day-btn";
            const dayLabel = dk.split("-")[2];
            dayBtn.textContent = `${dayLabel}日`;
            dayBtn.addEventListener("click", ()=>{
              // toggle posts for this day (if already shown, hide)
              const shown = postsDiv.getAttribute("data-day") === dk;
              if (shown){
                postsDiv.innerHTML = "";
                postsDiv.removeAttribute("data-day");
                return;
              }
              postsDiv.setAttribute("data-day", dk);
              postsDiv.innerHTML = "";
              // render posts for this day (roots first, with replies)
              const allDayPosts = tree[year][mk][dk];
              // map replies by parentId
              const replyMap = {};
              allDayPosts.forEach(p=>{
                if (p.parentId){
                  if (!replyMap[p.parentId]) replyMap[p.parentId]=[];
                  replyMap[p.parentId].push(p);
                }
              });
              // roots sorted by createdAt desc
              const roots = allDayPosts.filter(p=>!p.parentId).sort((a,b)=> b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
              roots.forEach(root=>{
                const card = makePostCard(root, replyMap[root.id] || []);
                postsDiv.appendChild(card);
              });
            });
            dayTagsDiv.appendChild(dayBtn);
          });
        });
        monthTagsDiv.appendChild(monthBtn);
      });
    });
    yearTagsDiv.appendChild(yearBtn);
  });
}

// create DOM for post + replies
function makePostCard(post, replies){
  const card = document.createElement("div");
  card.className = "post";
  if (isUnread(post.createdAt)) card.classList.add("unread");

  const timeText = post.createdAt && typeof post.createdAt.toDate==="function"
    ? post.createdAt.toDate().toLocaleString()
    : "日時なし";

  let inner = `<div><strong>${escapeHtml(post.name)}</strong>（${escapeHtml(timeText)}）</div>`;
  inner += `<div class="post-text">${escapeHtml(post.text).replace(/\n/g,"<br>")}</div>`;
  if (post.imageUrl) inner += `<img src="${escapeHtml(post.imageUrl)}" style="max-width:320px;margin-top:8px;border-radius:6px;">`;

  card.innerHTML = inner;

  // reply button + form
  const replyBtn = document.createElement("button");
  replyBtn.className = "reply-btn";
  replyBtn.textContent = "返信";
  card.appendChild(replyBtn);

  const form = document.createElement("div");
  form.className = "reply-form";
  form.style.display = "none";
  form.innerHTML = `
    <input class="reply-name" placeholder="名前"><br>
    <textarea class="reply-text" rows="3" cols="20" placeholder="返信内容"></textarea><br>
    <button class="reply-send">送信</button>
  `;
  card.appendChild(form);

  replyBtn.addEventListener("click", ()=> form.style.display = form.style.display === "none" ? "block" : "none");

  form.querySelector(".reply-send").addEventListener("click", async ()=>{
    const rname = form.querySelector(".reply-name").value.trim() || "名無し";
    const rtext = form.querySelector(".reply-text").value.trim();
    if (!rtext){ alert("返信内容を入力してください"); return; }
    await sendReply(post.id, rname, rtext);
    form.querySelector(".reply-name").value = "";
    form.querySelector(".reply-text").value = "";
    form.style.display = "none";
  });

  // replies (render under card)
  if (Array.isArray(replies) && replies.length>0){
    replies.sort((a,b)=> a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime());
    replies.forEach(r=>{
      const rdiv = document.createElement("div");
      rdiv.className = "post";
      rdiv.style.marginLeft = "18px";
      rdiv.style.background = "#fafafa";
      const rtime = r.createdAt && typeof r.createdAt.toDate==="function" ? r.createdAt.toDate().toLocaleString() : "日時なし";
      rdiv.innerHTML = `<div><strong>${escapeHtml(r.name)}</strong>（${escapeHtml(rtime)}）</div><div class="post-text">${escapeHtml(r.text).replace(/\n/g,"<br>")}</div>`;
      card.appendChild(rdiv);
    });
  }

  // delete button for post (optional)
  const del = document.createElement("button");
  del.textContent = "削除";
  del.style.marginLeft = "8px";
  del.addEventListener("click", async ()=>{
    if (!confirm("この投稿を削除しますか？（返信は残ります）")) return;
    try { await deleteDoc(doc(db,"posts",post.id)); } catch(e){ console.error(e); alert("削除失敗"); }
  });
  card.appendChild(del);

  return card;
}
