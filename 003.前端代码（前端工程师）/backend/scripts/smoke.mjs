/**
 * 登录/注册冒烟测试
 * 先启动服务：npm run dev
 * 再执行：npm run smoke
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, body: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const stamp = Date.now();
const email = `smoke_${stamp}@example.com`;
const password = 'abc12345';
const nickname = `测试${String(stamp).slice(-6)}`;

console.log(`测试账号：${email} / ${password}`);

const sendCode = await request('/api/auth/send-code', {
  method: 'POST',
  body: {
    accountType: 'email',
    account: email,
    purpose: 'register',
  },
});

assert(sendCode.status === 200, `发送验证码失败：${JSON.stringify(sendCode.body)}`);
const code = sendCode.body?.data?.devCode;
assert(code, '没有返回 devCode，请确认 .env 里 CODE_DEV_RETURN=true');

const register = await request('/api/auth/register', {
  method: 'POST',
  body: {
    accountType: 'email',
    account: email,
    code,
    password,
    nickname,
    agreed: true,
  },
});

assert(register.status === 200, `注册失败：${JSON.stringify(register.body)}`);
assert(register.body?.data?.token, '注册后没有返回 token');
const token = register.body.data.token;
console.log(`✅ 注册成功：${register.body.data.user.nickname}`);

const me = await request('/api/auth/me', { token });
assert(me.status === 200, `获取当前用户失败：${JSON.stringify(me.body)}`);
assert(me.body?.data?.user?.nickname === nickname, '当前用户昵称不一致');
console.log('✅ /api/auth/me 正常');

const logout = await request('/api/auth/logout', { method: 'POST', token });
assert(logout.status === 200, `退出登录失败：${JSON.stringify(logout.body)}`);

const afterLogout = await request('/api/auth/me', { token });
assert(afterLogout.status === 401, '退出登录后旧 token 应该失效');
console.log('✅ 退出登录后 token 已失效');

const login = await request('/api/auth/login', {
  method: 'POST',
  body: {
    account: email,
    password,
    rememberMe: false,
  },
});

assert(login.status === 200, `密码登录失败：${JSON.stringify(login.body)}`);
assert(login.body?.data?.token, '登录后没有返回 token');
console.log('✅ 密码登录成功');

console.log('');
console.log('🎉 登录/注册冒烟测试全部通过');
