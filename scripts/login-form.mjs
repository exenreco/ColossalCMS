export function loginFormScript(setup) {
  return `
const form = document.querySelector('form');
const button = form.querySelector('[type="submit"]');
const error = document.querySelector('#error');
const timer = document.createElement('p');
timer.className = 'hint';
form.append(timer);
let blockedUntil = 0, countdown;
function updateCountdown() {
  const seconds = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
  timer.textContent = seconds ? 'Try again in ' + seconds + ' seconds.' : '';
  button.disabled = seconds > 0;
  if (!seconds) { clearInterval(countdown); blockedUntil = 0; }
}
document.querySelector('.show').addEventListener('click', e => {
  const show = form.elements.password.type === 'password';
  form.elements.password.type = show ? 'text' : 'password';
  if (form.elements.confirm) form.elements.confirm.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Hide password' : 'Show password';
  e.currentTarget.setAttribute('aria-pressed', String(show));
});
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (blockedUntil > Date.now()) return;
  error.textContent = '';
  if (form.elements.confirm && form.elements.confirm.value !== form.elements.password.value) {
    error.textContent = 'Passwords do not match.'; return;
  }
  button.disabled = true;
  try {
    const response = await fetch('/api/auth/${setup ? "setup" : "login"}', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.elements.email.value, password: form.elements.password.value, token: form.elements.token?.value }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429 && Number.isInteger(data.retryAfter) && data.retryAfter > 0) {
        blockedUntil = Date.now() + data.retryAfter * 1000;
        clearInterval(countdown);
        countdown = setInterval(updateCountdown, 1000);
        updateCountdown();
      }
      const remaining = Number.isInteger(data.remainingAttempts)
        ? ' ' + data.remainingAttempts + ' attempts remaining.' : '';
      throw new Error((data.error || 'Unable to sign in.') + remaining);
    }
    location.assign('${setup ? "/login" : "/admin/"}');
  } catch (failure) { error.textContent = failure.message; }
  finally { button.disabled = blockedUntil > Date.now(); }
});`;
}
