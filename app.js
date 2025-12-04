// ===========================
// ▼ 設定
// ===========================
const READ_KEY = "bbs_last_read_time";
const STORAGE_KEY = "bbs_posts";

// 初期化：最終閲覧時間がない場合セット
if (!localStorage.getItem(READ_KEY)) {
    localStorage.setItem(READ_KEY, Date.now());
}

// ===========================
// ▼ 投稿保存
// ===========================
function savePosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

// ===========================
// ▼ 投稿読み込み
// ===========================
function loadPosts() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// ===========================
// ▼ 投稿表示
// ===========================
function renderPosts() {
    const posts = loadPosts();
    const container = document.getElementById("posts");
    container.innerHTML = "";

    posts.forEach(p => {
        const div = document.createElement("div");
        div.style.border = "1px solid #ccc";
        div.style.padding = "10px";
        div.style.marginBottom = "10px";

        div.innerHTML = `
            <strong>${p.name}</strong> (${new Date(p.timestamp).toLocaleString()})<br>
            ${p.text.replace(/\n/g, "<br>")}
            <br>
            ${p.image ? `<img src="${p.image}" style="max-width:200px; margin-top:5px;">` : ""}
        `;

        container.appendChild(div);
    });

    // 未読チェック
    checkUnread(posts);
}

// ===========================
// ▼ 投稿ボタン
// ===========================
document.getElementById("send").addEventListener("click", () => {
    const name = document.getElementById("name").value.trim();
    const text = document.getElementById("text").value.trim();
    const file = document.getElementById("image").files[0];

    if (!name || !text) {
        alert("名前と内容を入力してください");
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        const imageData = file ? reader.result : null;

        const posts = loadPosts();

        posts.unshift({
            name,
            text,
            image: imageData,
            timestamp: Date.now()
        });

        savePosts(posts);
        renderPosts();
    };

    if (file) {
        reader.readAsDataURL(file);
    } else {
        // 画像無し
        const posts = loadPosts();

        posts.unshift({
            name,
            text,
            image: null,
            timestamp: Date.now()
        });

        savePosts(posts);
        renderPosts();
    }

    // 入力クリア
    document.getElementById("text").value = "";
    document.getElementById("image").value = "";
});

// ===========================
// ▼ 通知（タイトル点滅）
// ===========================
let blinkTimer = null;

function startTitleBlink() {
    if (blinkTimer) return;

    let flag = false;
    const original = "掲示板";

    blinkTimer = setInterval(() => {
        document.title = flag ? "🔔 新着あり！" : original;
        flag = !flag;
    }, 800);
}

function stopTitleBlink() {
    if (blinkTimer) {
        clearInterval(blinkTimer);
        blinkTimer = null;
    }
    document.title = "掲示板";
}

// ===========================
// ▼ バッジ管理
// ===========================
function updateBadge(count) {
    const badge = document.getElementById("badge");

    if (count > 0) {
        badge.style.display = "inline-block";
        badge.textContent = count;
    } else {
        badge.style.display = "none";
    }
}

// ===========================
// ▼ 未読チェック（重要）
// ===========================
function checkUnread(posts) {
    const lastRead = Number(localStorage.getItem(READ_KEY)) || 0;
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1週間以内 ＋ 閲覧時間より後 → 未読
    const unread = posts.filter(p => {
        return p.timestamp > lastRead && (now - p.timestamp) < ONE_WEEK;
    });

    const count = unread.length;

    updateBadge(count);

    if (count > 0) {
        startTitleBlink();
    } else {
        stopTitleBlink();
    }
}

// ===========================
// ▼ ページに戻った時 → 既読扱い
// ===========================
window.addEventListener("focus", () => {
    localStorage.setItem(READ_KEY, Date.now());
    stopTitleBlink();
    updateBadge(0);
});

// ===========================
// ▼ 初期表示
// ===========================
renderPosts();
