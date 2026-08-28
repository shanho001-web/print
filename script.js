// 設定你的 GitHub 倉庫資訊
const REPO_OWNER = 'shanho001-web';
const REPO_NAME = 'information';

let pageList = JSON.parse(localStorage.getItem('my_vault_pages')) || [];
let activeUrl = null;

// 初始化：渲染選單
function renderMenu() {
  localStorage.setItem('my_vault_pages', JSON.stringify(pageList));
  const navList = document.getElementById('navList');
  navList.innerHTML = pageList.map((page, index) => `
    <li class="nav-item">
      <button class="nav-btn ${page.url === activeUrl ? 'active' : ''}" onclick="loadPage('${page.url}', this)">
        ${page.title}
      </button>
      <button class="delete-btn" onclick="deletePage(${index})">🗑️</button>
    </li>
  `).join('');
}

// 加載頁面到 iframe
function loadPage(url, btn) {
  activeUrl = url;
  document.getElementById('content-frame').src = url;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Modal 控制
function openAddModal() { document.getElementById('uploadModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 核心功能：發布文章
async function uploadPage() {
  const title = document.getElementById('pageTitle').value.trim();
  const rawName = document.getElementById('fileName').value.trim();
  const textContent = document.getElementById('textContent').value;
  const token = document.getElementById('githubToken').value.trim();

  if (!title || !rawName || !textContent || !token) return alert('請填寫完整資訊');

  // 檔名規範化 (只能英數橫線)
  const cleanName = rawName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() + '.html';
  const fileUrl = 'pages/' + cleanName;

  // 將內容轉為 HTML 結構
  const fullHTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="../style.css">
</head>
<body class="content-body" style="padding: 40px; max-width: 800px; margin: auto; line-height: 1.6;">
  <h1>${title}</h1>
  <div class="content-text">${textContent.replace(/\n/g, '<br>')}</div>
</body>
</html>`;

  const contentBase64 = btoa(unescape(encodeURIComponent(fullHTML)));

  try {
    // 1. 上傳 HTML 檔案到 pages/ 目錄
    const fileRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pages/${cleanName}`, {
      method: 'PUT',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Add ${cleanName}`, content: contentBase64 })
    });

    if (!fileRes.ok) throw new Error('HTML 檔案上傳失敗');

    // 2. 更新選單 (menu.json)
    await updateMenuOnGitHub(token, { title, url: fileUrl });

    alert('🎉 發布成功！');
    location.reload();
  } catch (e) {
    alert('❌ 錯誤: ' + e.message);
  }
}

// 更新雲端選單的核心邏輯
async function updateMenuOnGitHub(token, newPage) {
  const path = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/menu.json`;
  
  // 嘗試取得舊的 menu.json
  const getRes = await fetch(path, { headers: { 'Authorization': `token ${token}` } });
  let currentMenu = [];
  let sha = '';

  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
    // 確保內容能正確解析
    currentMenu = JSON.parse(atob(data.content));
  } else if (getRes.status !== 404) {
    throw new Error('無法讀取雲端選單');
  }

  // 加入新頁面
  currentMenu.push(newPage);

  // 推送回 GitHub
  const putRes = await fetch(path, {
    method: 'PUT',
    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Update menu.json',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(currentMenu, null, 2)))),
      sha: sha
    })
  });

  if (!putRes.ok) throw new Error('選單同步失敗');
}

// 從雲端同步選單
async function syncMenu() {
  const token = localStorage.getItem('dsh_github_token'); // 假設你之前存過，或者彈窗要你輸入
  // 這裡為了簡單，先用最直接的方式：從 raw 下載
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/menu.json`);
    if (res.ok) {
      const serverList = await res.json();
      pageList = serverList;
      renderMenu();
      alert('✅ 已從雲端載入最新選單');
    } else {
      alert('⚠️ 雲端沒有選單，請先在電腦端新增文章');
    }
  } catch (e) {
    alert('同步失敗，請檢查網路');
  }
}

// 刪除功能
async function deletePage(index) {
  if (!confirm('確定要刪除嗎？這將無法恢復。')) return;
  // 刪除邏輯較複雜（需處理 GitHub API），目前先從本地移除
  pageList.splice(index, 1);
  renderMenu();
}

// 初始化
renderMenu();