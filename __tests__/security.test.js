// Phase 26 app side: integrity header, no secrets in the app, release hardening config.
const fs = require('fs');
const path = require('path');

jest.mock('react-native-device-info', () => ({ isEmulator: jest.fn(async () => true) }));
jest.mock('@dr.pogodin/react-native-fs', () => ({ exists: jest.fn(async p => p === '/system/xbin/su') }));

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('device integrity header (P26.T06)', () => {
  test('rooted device reported; emulator NOT flagged in dev builds', async () => {
    const { getIntegrity, integrityHeader } = require('@services/security/deviceIntegrity');
    const i = await getIntegrity();
    expect(i).toEqual({ emulator: false, rooted: true }); // __DEV__ is true in tests
    expect(integrityHeader(i)).toBe('emulator=0;rooted=1');
    expect(integrityHeader({ emulator: true, rooted: false })).toBe('emulator=1;rooted=0');
  });
});

describe('no secrets in the app (P26.T16)', () => {
  const walk = dir =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
      const p = path.join(dir, d.name);
      return d.isDirectory() ? walk(p) : /\.(js|jsx)$/.test(d.name) ? [p] : [];
    });

  test('source has no server secrets, private keys or hard-coded tokens', () => {
    const bad =
      /(JWT_(ACCESS|REFRESH)_SECRET|ADMIN_API_KEY|TWILIO_AUTH_TOKEN|TWILIO_API_KEY_SECRET|RAZORPAY_KEY_SECRET|BREVO_API_KEY|BEGIN (RSA |EC )?PRIVATE KEY|xkeysib-|sk_live_)/;
    const hits = walk(path.join(ROOT, 'src')).filter(f => bad.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  test('.env.example only holds public ids', () => {
    const keys = read('.env.example')
      .split('\n')
      .filter(l => /^[A-Z_]+=/.test(l))
      .map(l => l.split('=')[0]);
    expect(keys.every(k => !/SECRET|PASSWORD|PRIVATE/.test(k))).toBe(true);
  });

  test('tokens are never written to AsyncStorage', () => {
    const hits = walk(path.join(ROOT, 'src')).filter(f => {
      const s = fs.readFileSync(f, 'utf8');
      return /AsyncStorage\.(setItem|setMany|multiSet)\([^)]*(accessToken|refreshToken|token)/i.test(s);
    });
    expect(hits).toEqual([]);
  });
});

describe('release hardening (P26.T15)', () => {
  test('R8 minify + resource shrinking on, console removed from release JS', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toMatch(/def enableProguardInReleaseBuilds = true/);
    expect(gradle).toMatch(/shrinkResources enableProguardInReleaseBuilds/);
    expect(read('babel.config.js')).toMatch(/production: \{ plugins: \['transform-remove-console'\] \}/);
  });

  test('NEW: release builds refuse an http API_BASE_URL', () => {
    expect(read('android/app/build.gradle')).toMatch(/API_BASE_URL must start with https:\/\/ for release builds/);
  });

  test('cleartext only via the RN placeholder (debug on, release off)', () => {
    expect(read('android/app/src/main/AndroidManifest.xml')).toMatch(
      /usesCleartextTraffic="\$\{usesCleartextTraffic\}"/,
    );
  });
});
