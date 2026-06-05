const admin = require('firebase-admin');
const path = require('path');

let db = null;
let firebaseReady = false;

try {
  let serviceAccount = null;

  // 讀取服務帳戶金鑰
  const keyPath = path.join(__dirname, '..', 'config', 'service-account-key.json');
  try {
    serviceAccount = require(keyPath);
    console.log('🔑 已載入服務帳戶金鑰');
  } catch (e) {
    console.error('❌ 找不到 config/service-account-key.json');
    console.error('   請從 Firebase Console 下載金鑰放到 config/ 目錄');
  }

  if (serviceAccount && admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    firebaseReady = true;
    console.log(`🔥 Firebase 已連接: ${serviceAccount.project_id}`);
  }
} catch (e) {
  console.error('❌ Firebase 初始化失敗:', e.message);
}

module.exports = { admin, db, firebaseReady };
