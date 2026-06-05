const { GoogleAuth } = require('google-auth-library');
const https = require('https');
const path = require('path');

const PROJECT_ID = 'telegram-bot-new-cef53';
const KEY_PATH = path.join(__dirname, '..', 'config', 'service-account-key.json');

function apiRequest(method, urlPath, body) {
  return new Promise(async (resolve, reject) => {
    const auth = new GoogleAuth({
      keyFile: KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = (await client.getAccessToken()).token;

    const options = {
      hostname: 'firestore.googleapis.com',
      path: urlPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ✅ ${method} ${urlPath} → ${res.statusCode}`);
          resolve(JSON.parse(data || '{}'));
        } else {
          console.log(`  ⚠️ ${method} ${urlPath} → ${res.statusCode}`);
          console.log(`     ${data.substring(0, 300)}`);
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🔧 创建 Firestore 复合索引...\n');

  // 需要的索引: transactions 集合, userId ASC + yearMonth ASC + createdAt ASC
  const index = {
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'yearMonth', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' }
    ]
  };

  const parent = `projects/${PROJECT_ID}/databases/(default)/collectionGroups/transactions`;
  
  // 先查一下是否已存在
  console.log('📋 检查现有索引...');
  const existing = await apiRequest('GET', `/v1/${parent}/indexes`);
  if (existing && existing.indexes) {
    for (const idx of existing.indexes) {
      console.log(`  已存在: ${idx.name}`);
    }
  }

  // 创建索引
  console.log('\n🚀 创建新索引...');
  const result = await apiRequest('POST', `/v1/${parent}/indexes`, index);
  
  if (result) {
    console.log('\n✅ 索引创建请求已提交！');
    console.log(`   索引名: ${result.name}`);
    console.log('   索引可能需要几分钟才能生效。');
  } else {
    console.log('\n⚠️ 索引可能已存在或创建中，请检查 Firebase 控制台。');
  }

  console.log(`\n🔗 控制台: https://console.firebase.google.com/v1/r/project/${PROJECT_ID}/firestore/indexes`);
}

main().catch(err => {
  if (err.message && err.message.includes('already exists')) {
    console.log('✅ 索引已存在，无需重复创建。');
  } else {
    console.error('❌ 错误:', err.message);
  }
});
