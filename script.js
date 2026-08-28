// ✅ 設定為你的新倉庫名稱 'print'
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

// ✅ 核心功能：發布文章
async function uploadPage() {
  const title = document.getElementById('pageTitle').value.trim();
  const rawName = document.getElementById('fileName').value.trim();
  const textContent = document.getElementById('textContent').value;
  const token = document.getElementById('githubToken').value.trim();

  if (!title || !rawName || !textContent || !token) return alert('請填寫完整資訊！');

  // 檔名規範化
  const cleanName = rawName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() + '.html';
  const fileUrl = 'pages/' + cleanName;

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
    const fileRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pages/${cleanName}`, {
      method: 'PUT',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: `Add new page: ${cleanName}`, 
        content: contentBase64 
      })
    });

    if (!fileRes.ok) {
      const errData = await fileRes.json();
      throw new Error(errData.message || 'HTML 上傳失敗');
    }

    await updateMenuOnGitHub(token, { title, url: fileUrl });

    alert('🚀 發布成功！');
    location.reload();
  } catch (e) {
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
    throw new Error('無法讀取雲端選單，請檢查 Token 權限');
  }

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
      alert('⚠️ 雲端還沒有選單，請先在電腦端新增文章。');
    }
  } catch (e) {
    alert('同步失敗，請檢查網路連線');
  }
}

async function deletePage(index) {
  if (!confirm('確定要刪除嗎？')) return;
  pageList.splice(index, 1);
  renderMenu();
}

renderMenu();