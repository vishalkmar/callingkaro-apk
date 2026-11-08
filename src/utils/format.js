import { formatE164ForDisplay } from './phone';

const CREDITS_PER_MINUTE = 1000;

export const creditsToMinutes = credits => {
  const n = Number(credits);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n / CREDITS_PER_MINUTE);
};

// Seconds of talk time the given credits allow (mirror of server maxSeconds).
export const creditsToSeconds = credits => {
  const n = Number(credits);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor((n * 60) / CREDITS_PER_MINUTE);
};

export const formatPhone = numberOrE164 => {
  if (!numberOrE164) {
    return '';
  }
  return formatE164ForDisplay(numberOrE164) || String(numberOrE164);
};

const pad = n => String(n).padStart(2, '0');

// 0 -> "0:00", 135 -> "2:15", 3725 -> "1:02:05"
export const formatDuration = seconds => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

// Timer style "00:42"
export const formatTimer = seconds => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatTime = ts => {
  if (!ts) {
    return '';
  }
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatDate = ts => {
  if (!ts) {
    return '';
  }
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatDateTime = ts => (ts ? `${formatDate(ts)}, ${formatTime(ts)}` : '');

export const formatNumber = n => {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatCredits = n => `${formatNumber(n)} cr`;

export const formatBytes = bytes => {
  const b = Number(bytes) || 0;
  if (b < 1024) {
    return `${b} B`;
  }
  if (b < 1024 * 1024) {
    return `${(b / 1024).toFixed(1)} KB`;
  }
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatRupees = paiseOrRupees => `Rs.${formatNumber(paiseOrRupees)}`;

// "05:12:30" countdown until a timestamp
export const formatCountdown = (targetTs, now = Date.now()) => {
  const s = Math.max(0, Math.floor((new Date(targetTs).getTime() - now) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

// Group label for call history: Today / Yesterday / This week / Older
export const dayGroup = (ts, now = Date.now()) => {
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date(now));
  const day = startOfDay(new Date(ts));
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return 'This week';
  }
  return 'Older';
};
