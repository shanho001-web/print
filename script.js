// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlgW4wgZ_GDUr2C9ra_vSFEU59PQqfKK0",
  authDomain: "myprint-b471c.firebaseapp.com",
  projectId: "myprint-b471c",
  storageBucket: "myprint-b471c.firebasestorage.app",
  messagingSenderId: "410227124042",
  appId: "1:410227124042:web:d9dbfbe1418a7864cbc3b3",
  measurementId: "G-RY4TZ7D7W4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ✅ 設定你的 GitHub 倉庫資訊
const REPO_OWNER = 'shanho001-web';
const REPO_NAME = 'print'; 

let pageList = JSON.parse(localStorage.getItem('my_vault_pages')) || [];
let activeUrl = null;

// 初始化：渲染選單
function renderMenu() {
  localStorage.setItem('my_vault_pages', JSON.stringify(pageList));
  const navList = document.getElementById('navList');
  if (!navList) return;
  
  navList.innerHTML = pageList.map((page, index) => `
    <li class="nav-item">
      <button class="nav-btn ${page.url === activeUrl ? 'active' : ''}" onclick="loadPage('${page.url}', this)">
        ${page.title}
      </button>
      <button class="delete-btn" onclick="deletePage(${index})">🗑️</button>
    </li>
  `).join('');
}

// 載入頁面到 iframe
function loadPage(url, btn) {
  activeUrl = url;
  const iframe = document.getElementById('content-frame');
  if (iframe) {
    iframe.src = url;
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Modal 控制
function openAddModal() { document.getElementById('uploadModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ✅【核心修復】發布文章：先查詢 SHA，確保不會發生 422 錯誤
async function uploadPage() {
  const title = document.getElementById('pageTitle').value.trim();
  const rawName = document.getElementById('fileName').value.trim();
  const textContent = document.getElementById('textContent').value;
  const token = document.getElementById('githubToken').value.trim();

  if (!title || !rawName || !textContent || !token) return alert('請填寫完整資訊！');

  // 檔名規範化
  const cleanName = rawName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() + '.html';
  const fileUrl = 'pages/' + cleanName;
  const repoPath = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pages/${cleanName}`;

  // 準備 HTML 內容
  const fullHTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="../style.css">
</head>
<body class="content-body" style="padding: 30px; max-width: 800px; margin: auto; line-height: 1.8; font-size: 18px; color: #333;">
  <h1 style="margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h1>
  <div class="content-text" style="white-space: pre-wrap;">${textContent}</div>
</body>
</html>`;

  const contentBase64 = btoa(unescape(encodeURIComponent(fullHTML)));

  try {
    console.log('正在檢查檔案是否存在...');
    // 1. 先嘗試獲取該檔案的 SHA (決定是要 CREATE 還是 UPDATE)
    const checkRes = await fetch(repoPath, {
      headers: { 'Authorization': `token ${token}` }
    });

    let sha = '';
    if (checkRes.ok) {
      const fileData = await checkRes.json();
      sha = fileData.sha;
      console.log('檔案已存在，準備進行更新 (SHA: ' + sha + ')');
    } else if (checkRes.status === 404) {
      console.log('檔案不存在，準備進行全新發布');
    } else {
      throw new Error('檢查檔案時發生錯誤: ' + checkRes.status);
    }

    // 2. 執行 PUT 請求
    const putRes = await fetch(repoPath, {
      method: 'PUT',
      headers: { 
        'Authorization': `token ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        message: sha ? `Update page: ${cleanName}` : `Add new page: ${cleanName}`, 
        content: contentBase64,
        sha: sha // 如果是新檔，sha 為空字串，GitHub 會自動處理
      })
    });

    if (!putRes.ok) {
      const errData = await putRes.json();
      throw new Error(errData.message || '檔案上傳失敗');
    }

    console.log('HTML 上傳成功！正在同步選單...');

    // 3. 同步更新選單 (menu.json)
    await updateMenuOnGitHub(token, { title, url: fileUrl });

    alert('🚀 發布成功！');
    location.reload();
  } catch (e) {
    console.error(e);
    alert('❌ 錯誤: ' + e.message);
  }
}

// ✅ 同步選單到 GitHub 的邏輯
async function updateMenuOnGitHub(token, newPage) {
  const path = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/menu.json`;
  
  const getRes = await fetch(path, { headers: { 'Authorization': `token ${token}` } });
  
  let currentMenu = [];
  let sha = '';

  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
    currentMenu = JSON.parse(atob(data.content));
  } else if (getRes.status !== 404) {
    throw new Error('無法讀取雲端選單');
  }

  // 防止重複加入相同的 URL
  if (!currentMenu.find(p => p.url === newPage.url)) {
    currentMenu.push(newPage);
  }

  const putRes = await fetch(path, {
    method: 'PUT',
    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: sha ? 'Sync menu' : 'Initialize menu.json',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(currentMenu, null, 2)))),
      sha: sha
    })
  });

  if (!putRes.ok) throw new Error('選單同步失敗');
}

// ✅ 從雲端強制同步選單 (手機端用)
async function syncMenu() {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/menu.json`);
    if (res.ok) {
      const serverList = await res.json();
      pageList = serverList;
      localStorage.setItem('my_vault_pages', JSON.stringify(pageList));
      renderMenu();
      alert('✅ 已從雲端同步最新選單');
    } else {
      alert('⚠️ 雲端還沒有選單，請先在電腦端新增文章');
    }
  } catch (e) {
    alert('同步失敗，請檢查網路連線');
  }
}

// 刪除功能
async function deletePage(index) {
  if (!confirm('確定要刪除嗎？')) return;
  pageList.splice(index, 1);
  renderMenu();
}

// Expose functions to window so they are globally accessible from HTML inline onclick handlers
window.syncMenu = syncMenu;
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.uploadPage = uploadPage;
window.deletePage = deletePage;
window.loadPage = loadPage;

// 初始化
renderMenu();