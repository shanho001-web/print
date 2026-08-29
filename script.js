import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

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
const db = getFirestore(app);

// Firestore helper functions
async function savePageToFirestore(title, content, fileName) {
  try {
    await setDoc(doc(db, "pages", fileName), {
      title: title,
      content: content,
      createdAt: new Date()
    });
    console.log("Document successfully written!");
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
}

async function getPagesFromFirestore() {
  const pagesCol = collection(db, "pages");
  const pagesSnapshot = await getDocs(pagesCol);
  const pagesList = pagesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  return pagesList;
}

async function deletePageToFirestore(pageId) {
  try {
    await deleteDoc(doc(db, "pages", pageId));
    console.log("Document successfully deleted!");
  } catch (e) {
    console.error("Error removing document: ", e);
    throw e;
  }
}

let pageList = [];
let activeUrl = null;

// 初始化：渲染選單
async function renderMenu() {
  pageList = await getPagesFromFirestore();
  
  const navList = document.getElementById('navList');
  if (!navList) return;
  
  navList.innerHTML = pageList.map((page) => `
    <li class="nav-item">
      <button class="nav-btn ${page.id === activeUrl ? 'active' : ''}" onclick="loadPage('${page.id}', this)">
        ${page.title}
      </button>
      <button class="edit-btn" onclick="editPage('${page.id}')">✏️</button>
      <button class="delete-btn" onclick="deletePage('${page.id}')">🗑️</button>
    </li>
  `).join('');
}

// 載入頁面到 iframe
function loadPage(pageId, btn) {
  activeUrl = pageId;
  const iframe = document.getElementById('content-frame');
  
  // Find page data
  const page = pageList.find(p => p.id === pageId);
  
  if (iframe && page) {
    // Inject content directly
    iframe.srcdoc = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>${page.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="content-body" style="padding: 30px; max-width: 800px; margin: auto; line-height: 1.8; font-size: 18px; color: #333;">
  <h1 style="margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">${page.title}</h1>
  <div class="content-text" style="white-space: pre-wrap;">${page.content}</div>
</body>
</html>`;
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Modal 控制
function openAddModal() { 
  document.getElementById('fileName').readOnly = false; // Reset readOnly
  document.getElementById('uploadModal').style.display = 'flex'; 
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 發布文章
async function uploadPage() {
  const title = document.getElementById('pageTitle').value.trim();
  const rawName = document.getElementById('fileName').value.trim();
  const textContent = document.getElementById('textContent').value;

  if (!title || !rawName || !textContent) return alert('請填寫標題、檔名與內容！');

  // 檔名規範化
  const cleanName = rawName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  
  try {
    console.log('正在上傳至 Firestore...');
    await savePageToFirestore(title, textContent, cleanName);
    alert('🚀 已儲存至 Firestore！');
    closeModal('uploadModal');
    // Clear inputs
    document.getElementById('pageTitle').value = '';
    document.getElementById('fileName').value = '';
    document.getElementById('textContent').value = '';
    await renderMenu(); // Refresh menu
  } catch (e) {
    console.error(e);
    alert('❌ 儲存失敗: ' + e.message);
  }
}

// 刪除功能
async function deletePage(pageId) {
  if (!confirm('確定要刪除嗎？')) return;
  try {
    await deletePageToFirestore(pageId);
    await renderMenu(); // Refresh menu
  } catch (e) {
    console.error("Deletion error:", e);
    alert('❌ 刪除失敗: ' + e.message);
  }
}

// 編輯功能
function editPage(pageId) {
  const page = pageList.find(p => p.id === pageId);
  if (!page) return;

  document.getElementById('pageTitle').value = page.title;
  document.getElementById('fileName').value = page.id;
  document.getElementById('fileName').readOnly = true; // 不能改 ID
  document.getElementById('textContent').value = page.content;
  
  openAddModal();
}

// Expose functions to window
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.uploadPage = uploadPage;
window.deletePage = deletePage;
window.editPage = editPage;
window.loadPage = loadPage;

// 初始化
renderMenu();