// app.js（完成版）
// -----------------
// Firebase モジュール版（1回だけ import）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Firebase 設定（ここをあなたの値に置き換える） ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 初期化（必ず1回）
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// HTML要素（index.html 側に存在する前提）
const nameInput = document.getElementById("name");
const textInput = document.getElementById("text");
const sendBtn = document.getElementById("send");
const postsDiv = document.getElementById("posts");

// --- 送信処理（createdAt フィールド名で統一） ---
sendBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "名無し").trim();
  const text = (textInput.value || "").trim();
  if (!text) return;

  try {
    console.log("投稿送信処理開始");
    await addDoc(collection(db, "posts"), {
      name,
      text,
      createdAt: serverTimestamp()
    });
    console.log("投稿送信成功");
    textInput.value = "";
  } catch (err) {
    console.error("Firestore 書き込みエラー:", err);
  }
});

// --- リアルタイム取得（onSnapshot は一度だけ） ---
// posts コレクションを createdAt 降順で取得
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  postsDiv.innerHTML = ""; // いったんクリア

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    // createdAt が存在すれば Date に変換して日本語で整形
    let timeText = "日時なし";
    if (data.createdAt && typeof data.createdAt.toDate === "function") {
      const date = data.createdAt.toDate();
      timeText = date.toLocaleString("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    }

    // 投稿カードを作る
    const card = document.createElement("div");
    card.className = "post";

    card.innerHTML = `
      <div class="name">${escapeHtml(data.name || "名無し")}</div>
      <div class="time">${escapeHtml(timeText)}</div>
      <div class="text">${escapeHtml(data.text || "").replace(/\n/g, "<br>")}</div>
    `;

    // 削除ボタン（必要なら表示）
    const delBtn = document.createElement("button");
    delBtn.className = "deleteBtn";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", async () => {
      if (!confirm("この投稿を削除しますか？")) return;
      try {
        await deleteDoc(doc(db, "posts", docSnap.id));
      } catch (e) {
        console.error("削除エラー:", e);
      }
    });

    card.appendChild(delBtn);
    postsDiv.appendChild(card);
  });
}, (error) => {
  console.error("onSnapshot エラー:", error);
});

// --- ユーザー入力の中で悪意ある HTML を無効化する簡単な関数 ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
