const admin = require('firebase-admin');
const path = require('path');

let db = null;
let firebaseReady = false;

try {
  // 方式1：從環境變量讀取 Firestore 服務帳戶
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('🔑 已從環境變量載入服務帳戶');
    } catch (e) {
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT 格式錯誤:', e.message);
    }
  }

  // 方式2：從 config 目錄讀取本地金鑰文件
  if (!serviceAccount) {
    const serviceAccountPath = path.join(__dirname, '..', 'config', 'service-account-key.json');
    try {
      serviceAccount = require(serviceAccountPath);
      console.log('🔑 已從文件載入服務帳戶金鑰');
    } catch (error) {
      console.warn('⚠️  未找到服務帳戶金鑰，Firebase 功能將受限');
    }
  }

  // 初始化 Firebase Admin SDK
  const appOptions = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'telegram-bot-new-cef53'
  };
  if (serviceAccount) {
    appOptions.credential = admin.credential.cert(serviceAccount);
  }
  if (process.env.FIREBASE_DATABASE_URL) {
    appOptions.databaseURL = process.env.FIREBASE_DATABASE_URL;
  }

  if (admin.apps.length === 0) {
    admin.initializeApp(appOptions);
  }
  
  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  firebaseReady = true;
  console.log(`🔥 Firebase 已連接: ${admin.app().options.projectId || '未知項目'}`);
} catch (e) {
  console.warn('⚠️  Firebase 初始化失敗，Bot 將以離線模式運行:', e.message);
  firebaseReady = false;
}

module.exports = { admin, db, firebaseReady };
