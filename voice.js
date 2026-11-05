// Voice input (Spanish) where the browser offers speech recognition.
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const voiceSupported = () => Boolean(SR);

export function listen({ lang = 'es-ES' } = {}) {
  return new Promise((resolve, reject) => {
    if (!SR) { reject(new Error('unsupported')); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let text = '';
    rec.onresult = e => { text = Array.from(e.results).map(r => r[0].transcript).join(' '); };
    rec.onerror = e => reject(new Error(e.error || 'error'));
    rec.onend = () => resolve(text.trim());
    rec.start();
  });
}

// Wires a mic button to an input: fills it with what was heard and calls onText.
export function attachMic(button, input, onText) {
  if (!voiceSupported()) { button.hidden = true; return; }
  button.addEventListener('click', async () => {
    button.classList.add('listening');
    try {
      const said = await listen();
      if (said) {
        input.value = input.tagName === 'TEXTAREA' && input.value.trim() ? `${input.value.trim()}\n${said}` : said;
        onText && onText(said);
      }
    } catch { /* permission denied or nothing heard */ }
    button.classList.remove('listening');
  });
}
