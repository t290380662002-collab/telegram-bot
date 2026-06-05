const { GoogleAuth } = require('google-auth-library');
const https = require('https');
const path = require('path');

const PROJECT_ID = 'telegram-bot-new-cef53';
const KEY_PATH = path.join(__dirname, '..', 'config', 'service-account-key.json');

async function createFirestore() {
  console.log('🔑 加载服务账户密钥...');
  const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = accessToken.token;

  console.log('✅ 已获取访问令牌');

  // 先检查 Firestore 是否已存在
  console.log('🔍 检查 Firestore 数据库状态...');
  
  const checkOptions = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const checkResult = await new Promise((resolve, reject) => {
    const req = https.request(checkOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`   状态码: ${checkResult.status}`);

  if (checkResult.status === 200) {
    const result = JSON.parse(checkResult.body);
    if (result.databases && result.databases.length > 0) {
      console.log('✅ Firestore 数据库已存在！');
      result.databases.forEach(db => {
        console.log(`   - 数据库: ${db.name} (状态: ${db.state})`);
      });
      return;
    }
  }

  // 创建 Firestore 数据库
  console.log('🚀 创建 Firestore 数据库...');
  
  const createOptions = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases?databaseId=(default)`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const createBody = JSON.stringify({
    type: 'FIRESTORE_NATIVE',
    locationId: 'asia-southeast1'
  });

  const createResult = await new Promise((resolve, reject) => {
    const req = https.request(createOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(createBody);
    req.end();
  });

  console.log(`   状态码: ${createResult.status}`);

  if (createResult.status === 200 || createResult.status === 202) {
    console.log('✅ Firestore 数据库创建成功！（可能需要几分钟完全生效）');
    if (createResult.body) {
      const parsed = JSON.parse(createResult.body);
      console.log(JSON.stringify(parsed, null, 2));
    }
  } else {
    console.error('❌ 创建失败:', createResult.body);
    // 如果已存在，也算成功
    if (createResult.body.includes('already exists')) {
      console.log('✅ Firestore 数据库已存在（可能之前已创建）');
    }
  }
}

createFirestore().catch(err => {
  console.error('❌ 错误:', err.message);
});
