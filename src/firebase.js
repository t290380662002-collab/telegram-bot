// 使用 Firebase Compat SDK（API 與 Admin SDK 相同，免服務帳戶金鑰）
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCXIFVxzuN8_ROtRRXl5wZv5xU_2oAw2PY',
  authDomain: 'macau-168.firebaseapp.com',
  projectId: 'macau-168',
  storageBucket: 'macau-168.firebasestorage.app',
  messagingSenderId: '172589695649',
  appId: '1:172589695649:web:371ab4a510aed1af71e6e0'
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.settings({ ignoreUndefinedProperties: true });

const firebaseReady = true;

console.log(`🔥 Firebase 已連接 (Compat SDK): macau-168`);

// 相容層：模擬 admin.firestore.Timestamp
const admin = {
  firestore: {
    Timestamp: firebase.firestore.Timestamp,
    FieldValue: firebase.firestore.FieldValue
  }
};

module.exports = { admin, db, firebaseReady };
