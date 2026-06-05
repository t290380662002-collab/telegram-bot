/**
 * 设置 Firestore 安全规则 —— 禁止所有外部访问，仅允许服务账户操作
 */
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'telegram-bot-new-cef53';

// 安全规则内容
const RULES = {
  files: [{
    name: 'firestore.rules',
    content: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`
  }]
};

async function main() {
  try {
    // 从环境变量或文件加载服务账户
    let keyFile;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      keyFile = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ 从环境变量加载服务账户');
    } else {
      const keyPath = path.join(__dirname, '..', 'config', 'service-account-key.json');
      keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      console.log('✅ 从文件加载服务账户');
    }

    // 创建 Auth 客户端
    const auth = new GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = token.token;

    console.log('🔑 已获取 Access Token');

    // 调用 Firebase Rules API 创建规则集
    const url = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: RULES
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ 安全规则创建成功！');
      console.log(`   规则集名称: ${result.name}`);

      // 发布规则集
      const rulesetName = result.name;
      const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`;
      
      const releaseResponse = await fetch(releaseUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rulesetName: rulesetName
        })
      });

      const releaseResult = await releaseResponse.json();
      if (releaseResponse.ok) {
        console.log('✅ 规则已发布生效！现在外部用户无法直接访问 Firestore 数据。');
        console.log('   只有通过服务账户（Admin SDK）才能读写数据。');
      } else {
        // 规则可能已经自动发布，尝试读取当前规则确认
        const checkUrl = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`;
        const checkResponse = await fetch(checkUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const checkResult = await checkResponse.json();
        if (checkResult.rulesetName === rulesetName) {
          console.log('✅ 规则已自动发布生效！');
          console.log('   只有通过服务账户（Admin SDK）才能读写数据。');
        } else {
          console.log('⚠️  发布状态:', JSON.stringify(releaseResult, null, 2));
          console.log('   当前规则:', checkResult.rulesetName);
        }
      }
    } else {
      console.error('❌ 创建规则失败:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
