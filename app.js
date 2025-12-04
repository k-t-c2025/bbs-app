// app.js（統合版）
// ------------------
// Firebase imports (modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// --- Firebase 設定（あなたの値） ---
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

// DOM 要素
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const imageInput = document.getElementById("image");
const sendBtn = document.getElementById("send");
const postsDiv = document.getElementById("posts");
const monthTagsDiv = document.getElementById("monthTags");
const dayTagsDiv = document.getElementById("dayTags");
const badge = document.getElementById("badge");

// 未読判定（7日）
const UNREAD_LIMIT = 7 * 24 * 60 * 60 * 1000;

// タイトル点滅
let blinkTimer = null;
const originalTitle = document.title || "掲示板";
function startBlink() {
  if (blinkTimer) return;
  let flag = false;
  blinkTimer = setInterval(() => {
    document.title = flag ? originalTitle : "★新着あり★ 掲示板";
    flag = !flag;
  }, 800);
}
function stopBlinkIfNoUnread(count) {
  if (count === 0 && blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
    document.title = originalTitle;
  }
}

// textareaを横20文字×縦5行に（HTMLが違ってたら無視されるが設定する）
if (textInput) {
  try {
    textInput.setAttribute("cols", "20");
    textInput.setAttribute("rows", "5");
  } catch (e) { /* ignore */ }
}

// helper: HTML escape
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: format year/month/day keys
function yKey(d) { return `${d.getFullYear()}`; }
function mKey(d) { return `${d.getFullYear()}-${d.getMonth() + 1}`; }
function dKey(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

// --- 投稿送信（画像があれば Storage にアップ） ---
sendBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "名無し").trim();
  const text = (textInput.value || "").trim();

  if (!text && (!imageInput || !imageInput.files || imageInput.files.length === 0)) {
    alert("投稿内容か画像を入力してください。");
    return;
  }

  sendBtn.disabled = true;
  try {
    let imageUrl = "";
    if (imageInput && imageInput.files && imageInput.files[0]) {
      const file = imageInput.files[0];
      const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
    }

    await addDoc(collection(db, "posts"), {
      name,
      text,
      imageUrl: imageUrl || "",
      parentId: null,
      createdAt: serverTimestamp()
    });

    textInput.value = "";
    if (imageInput) imageInput.value = "";
  } catch (err) {
    console.error("投稿エラー:", err);
    alert("投稿に失敗しました（Consoleを確認）。");
  } finally {
    sendBtn.disabled = false;
  }
});

// --- 返信を書き込む関数 ---
async function sendReply(parentId, replyName, replyText) {
  try {
    await addDoc(collection(db, "posts"), {
      name: replyName || "名無し",
      text: replyText,
      imageUrl: "",
      parentId: parentId,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("返信送信エラー:", err);
    alert("返信に失敗しました（Consoleを確認）。");
  }
}

// --- Firestore からリアルタイム取得してグループ化 ---
const postsCol = collection(db, "posts");
const q = query(postsCol, orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  // collect docs
  const docs = [];
  snapshot.forEach(s => {
    docs.push({ id: s.id, ...s.data() });
  });

  // build tree: year -> month -> day -> posts[]
  const tree = {}; // { year: { monthKey: { dayKey: [posts...] } } }
  const now = Date.now();
  let unreadCount = 0;

  docs.forEach(p => {
    if (!p.createdAt || typeof p.createdAt.toDate !== "function") return;
    const d = p.createdAt.toDate();
    const yk = yKey(d);
    const mk = mKey(d);
    const dk = dKey(d);

    if (!tree[yk]) tree[yk] = {};
    if (!tree[yk][mk]) tree[yk][mk] = {};
    if (!tree[yk][mk][dk]) tree[yk][mk][dk] = [];

    tree[yk][mk][dk].push(p);

    // unread if within 7 days
    const t = d.getTime();
    if (now - t < UNREAD_LIMIT) unreadCount++;
  });

  // update badge & title blink
  updateBadgeAndBlink(unreadCount);

  // render month/day tags and posts
  renderTree(tree);
});

// update badge & blink helper
function updateBadgeAndBlink(unreadCount) {
  if (unreadCount > 0) {
    badge.style.display = "inline-block";
    badge.textContent = unreadCount;
    startBlink();
  } else {
    badge.style.display = "none";
    stopBlinkIfNoUnread(0);
  }
}

// Render the entire tree UI
function renderTree(tree) {
  // clear containers
  monthTagsDiv.innerHTML = "";
  dayTagsDiv.innerHTML = "";
  postsDiv.innerHTML = "";

  // For each year (sorted desc)
  const years = Object.keys(tree).sort((a,b) => Number(b) - Number(a));
  years.forEach(year => {
    // Create year box
    const yearBox = document.createElement("div");
    yearBox.className = "year-box";

    const yearTag = document.createElement("div");
    yearTag.className = "year-tag";
    yearTag.textContent = `${year}年`;
    yearBox.appendChild(yearTag);

    // months for this year sorted desc by month number
    const months = Object.keys(tree[year]).sort((a,b) => {
      // a,b like "2025-11" — compare month part
      const ma = Number(a.split("-")[1]), mb = Number(b.split("-")[1]);
      return mb - ma;
    });

    months.forEach(monthKey => {
      const monthNum = monthKey.split("-")[1];
      const monthTag = document.createElement("div");
      monthTag.className = "month-tag";
      monthTag.textContent = `${monthNum}月`;
      // month child container (holds day tags)
      const monthChild = document.createElement("div");
      monthChild.className = "month-child";
      monthChild.style.display = "none";

      // month click toggles monthChild
      monthTag.addEventListener("click", () => {
        monthChild.style.display = monthChild.style.display === "none" ? "block" : "none";
      });

      // day keys sorted desc
      const days = Object.keys(tree[year][monthKey]).sort((a,b) => {
        const da = Number(a.split("-")[2]), db = Number(b.split("-")[2]);
        return db - da;
      });

      days.forEach(dayKey => {
        const dayNum = Number(dayKey.split("-")[2]);
        const dayTag = document.createElement("div");
        dayTag.className = "day-tag";
        dayTag.textContent = `${dayNum}日`;

        const dayChild = document.createElement("div");
        dayChild.className = "day-child";
        dayChild.style.display = "none";

        // day click toggles dayChild
        dayTag.addEventListener("click", () => {
          dayChild.style.display = dayChild.style.display === "none" ? "block" : "none";
        });

        // Add posts for the day into dayChild
        // We'll show root posts (parentId === null) for that day, and their replies nested beneath them
        const dayPosts = tree[year][monthKey][dayKey];

        // collect replies mapping: parentId -> [reply,...]
        const repliesByParent = {};
        dayPosts.forEach(p => {
          if (p.parentId) {
            if (!repliesByParent[p.parentId]) repliesByParent[p.parentId] = [];
            repliesByParent[p.parentId].push(p);
          }
        });

        // render root posts (created that day)
        dayPosts
          .filter(p => !p.parentId)
          .sort((a,b) => {
            // newer first
            const ta = a.createdAt.toDate().getTime();
            const tb = b.createdAt.toDate().getTime();
            return tb - ta;
          })
          .forEach(root => {
            const card = createPostCard(root, repliesByParent[root.id] || []);
            dayChild.appendChild(card);
          });

        monthChild.appendChild(dayTag);
        monthChild.appendChild(dayChild);
      });

      yearBox.appendChild(monthTag);
      yearBox.appendChild(monthChild);
    });

    postsDiv.appendChild(yearBox);
  });
}

// create post card element (root post + show replies under it)
function createPostCard(post, replies = []) {
  const card = document.createElement("div");
  card.className = "post";

  // unread check
  let isUnread = false;
  if (post.createdAt && typeof post.createdAt.toDate === "function") {
    const t = post.createdAt.toDate().getTime();
    if (Date.now() - t < UNREAD_LIMIT) {
      isUnread = true;
      card.classList.add("unread");
    }
  }

  const timeText = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate().toLocaleString("ja-JP") : "日時なし";

  // main content
  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = `
    <div><strong>${escapeHtml(post.name)}</strong>（${escapeHtml(timeText)}）</div>
    <div class="post-text">${escapeHtml(post.text).replace(/\n/g, "<br>")}</div>
    ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" style="max-width:200px;margin-top:6px;border-radius:6px;">` : ""}
  `;

  card.appendChild(contentDiv);

  // reply button + form
  const replyBtn = document.createElement("button");
  replyBtn.className = "reply-btn";
  replyBtn.textContent = "返信";
  replyBtn.style.marginTop = "8px";

  const replyForm = document.createElement("div");
  replyForm.className = "reply-form";
  replyForm.style.display = "none";
  replyForm.innerHTML = `
    <input type="text" class="reply-name" placeholder="名前"><br>
    <textarea class="reply-text" rows="3" cols="20" placeholder="返信内容"></textarea><br>
    <button class="reply-send">送信</button>
  `;

  replyBtn.addEventListener("click", () => {
    replyForm.style.display = replyForm.style.display === "none" ? "block" : "none";
  });

  card.appendChild(replyBtn);
  card.appendChild(replyForm);

  // reply send handler
  replyForm.querySelector(".reply-send").addEventListener("click", async () => {
    const rname = replyForm.querySelector(".reply-name").value.trim() || "名無し";
    const rtext = replyForm.querySelector(".reply-text").value.trim();
    if (!rtext) {
      alert("返信内容を入力してください。");
      return;
    }
    // send reply (no image)
    await sendReply(post.id, rname, rtext);
    // clear form
    replyForm.querySelector(".reply-name").value = "";
    replyForm.querySelector(".reply-text").value = "";
    replyForm.style.display = "none";
  });

  // render replies under this card (if any)
  if (Array.isArray(replies) && replies.length > 0) {
    // sort replies by createdAt ascending (older first)
    replies.sort((a,b) => {
      const ta = a.createdAt?.toDate().getTime() || 0;
      const tb = b.createdAt?.toDate().getTime() || 0;
      return ta - tb;
    });

    replies.forEach(r => {
      const rDiv = document.createElement("div");
      rDiv.className = "post";
      rDiv.style.marginLeft = "18px";
      rDiv.style.background = "#fafafa";

      const rtime = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString("ja-JP") : "日時なし";
      rDiv.innerHTML = `
        <div><strong>${escapeHtml(r.name)}</strong>（${escapeHtml(rtime)}）</div>
        <div class="post-text">${escapeHtml(r.text).replace(/\n/g, "<br>")}</div>
      `;
      card.appendChild(rDiv);
    });
  }

  // delete button (for root posts only)
  const delBtn = document.createElement("button");
  delBtn.className = "deleteBtn";
  delBtn.textContent = "削除";
  delBtn.style.marginLeft = "8px";
  delBtn.addEventListener("click", async () => {
    if (!confirm("この投稿を削除しますか？（返信は残ります）")) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
    } catch (e) {
      console.error("削除エラー", e);
      alert("削除に失敗しました。Consoleを確認してください。");
    }
  });

  card.appendChild(delBtn);

  return card;
}

// end of file
