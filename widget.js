/* АбсолютМед, чат-віджет реєстратури. Ставиться одним тегом:
   <script src="widget.js" data-endpoint="https://n8n.businessautomation.space/webhook/absolutmed-chat"
           data-color="#0077b3" data-site="absolutmed.lviv.ua"></script>
   Даних у скрипті немає: усе (промпт, довідник, ціни) живе в n8n. */
(function () {
  'use strict';
  if (window.__absolutmedChatLoaded) { return; }
  window.__absolutmedChatLoaded = true;

  var script = document.currentScript;
  var ds = (script && script.dataset) || {};
  var ENDPOINT = ds.endpoint || 'https://n8n.businessautomation.space/webhook/absolutmed-chat';
  var COLOR = ds.color || '#0077b3';
  var SITE = ds.site || location.hostname;
  var TITLE = ds.title || 'Онлайн-чат АбсолютМед';
  var STORE_KEY = 'absolutmed_chat_v1';
  var TTL_MS = 6 * 3600 * 1000;

  var GREETING = 'Доброго дня! Медичний центр Абсолют, мене звати Оля, я віртуальний асистент реєстратури. Листування зберігається і передається реєстратурі. Скажіть, будь ласка, чим можу допомогти?';
  var START_BUTTONS = ['Записатися на МРТ', 'Записатися на КТ', 'Ціни та підготовка'];
  var CONSENT = 'Надсилаючи повідомлення, ви погоджуєтесь на обробку персональних даних медичним центром для запису на обстеження.';

  var state = load();

  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.session_id && (Date.now() - (s.updated || 0)) < TTL_MS) { return s; }
      }
    } catch (e) {}
    return fresh();
  }
  function fresh() {
    return { session_id: uid(), messages: [], status: 'in_progress', buttons: START_BUTTONS.slice(), open: false, updated: Date.now() };
  }
  function save() {
    state.updated = Date.now();
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function uid() {
    var s = '';
    for (var i = 0; i < 24; i++) { s += Math.floor(Math.random() * 36).toString(36); }
    return 'ch-' + Date.now().toString(36) + '-' + s;
  }

  /* ---------- розмітка ---------- */
  var host = document.createElement('div');
  host.id = 'absolutmed-chat';
  var root = host.attachShadow({ mode: 'open' });

  var css = ''
    + ':host{all:initial}'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + '.am{position:fixed;right:20px;bottom:20px;z-index:2147483000;font:15px/1.45 -apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif;color:#1c2430}'
    + '.am-btn{width:60px;height:60px;border-radius:50%;border:0;background:' + COLOR + ';color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;transition:transform .15s}'
    + '.am-btn:hover{transform:scale(1.06)}'
    + '.am-btn svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + '.am-panel{position:absolute;right:0;bottom:0;width:380px;max-width:calc(100vw - 40px);height:620px;max-height:calc(100vh - 40px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}'
    + '.am.open .am-panel{display:flex}'
    + '.am.open .am-btn{display:none}'
    + '.am-head{background:' + COLOR + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}'
    + '.am-head .t{font-weight:600;font-size:16px}'
    + '.am-head .s{font-size:12px;opacity:.85}'
    + '.am-head .x{margin-left:auto;background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 6px}'
    + '.am-body{flex:1;overflow-y:auto;padding:14px 12px;background:#f3f5f8;display:flex;flex-direction:column;gap:8px}'
    + '.m{max-width:85%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}'
    + '.m.a{align-self:flex-start;background:#fff;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '.m.u{align-self:flex-end;background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px}'
    + '.m.err{align-self:center;background:#fff3f3;color:#9b1c1c;font-size:13px;text-align:center}'
    + '.btns{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:90%}'
    + '.btns button{border:1.5px solid ' + COLOR + ';color:' + COLOR + ';background:#fff;border-radius:18px;padding:7px 13px;font:inherit;font-size:14px;cursor:pointer}'
    + '.btns button:hover{background:' + COLOR + ';color:#fff}'
    + '.typing{align-self:flex-start;background:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:4px}'
    + '.typing i{width:7px;height:7px;border-radius:50%;background:#9aa4b1;animation:am-b 1.2s infinite}'
    + '.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}'
    + '@keyframes am-b{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}'
    + '.am-foot{border-top:1px solid #e6e9ee;background:#fff;padding:8px 10px 6px}'
    + '.row{display:flex;gap:8px;align-items:flex-end}'
    + 'textarea{flex:1;resize:none;border:1px solid #d5dae2;border-radius:12px;padding:9px 12px;font:inherit;max-height:110px;outline:none}'
    + 'textarea:focus{border-color:' + COLOR + '}'
    + 'textarea:disabled{background:#f3f5f8}'
    + '.send{width:42px;height:42px;border-radius:50%;border:0;background:' + COLOR + ';color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}'
    + '.send:disabled{opacity:.5;cursor:default}'
    + '.send svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + '.consent{font-size:11px;color:#7a8594;margin-top:6px;line-height:1.35}'
    + '.restart{align-self:center;margin-top:4px;border:0;background:transparent;color:' + COLOR + ';text-decoration:underline;cursor:pointer;font:inherit;font-size:14px}'
    + '@media (max-width:480px){.am{right:0;bottom:0}.am-btn{margin:0 16px 16px 0}.am-panel{width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}}';

  root.innerHTML = '<style>' + css + '</style>'
    + '<div class="am">'
    + '<button class="am-btn" aria-label="Відкрити чат"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 1 1 21 12z"/></svg></button>'
    + '<div class="am-panel" role="dialog" aria-label="' + TITLE + '">'
    + '<div class="am-head"><div><div class="t">' + esc(TITLE) + '</div><div class="s">Оля, віртуальний асистент реєстратури</div></div><button class="x" aria-label="Закрити">×</button></div>'
    + '<div class="am-body"></div>'
    + '<div class="am-foot"><div class="row"><textarea rows="1" placeholder="Надіслати повідомлення..." aria-label="Повідомлення"></textarea>'
    + '<button class="send" aria-label="Надіслати"><svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button></div>'
    + '<div class="consent">' + esc(CONSENT) + '</div></div>'
    + '</div></div>';

  var wrap = root.querySelector('.am');
  var body = root.querySelector('.am-body');
  var ta = root.querySelector('textarea');
  var sendBtn = root.querySelector('.send');
  var busy = false;

  root.querySelector('.am-btn').addEventListener('click', function () { setOpen(true); });
  root.querySelector('.x').addEventListener('click', function () { setOpen(false); });
  sendBtn.addEventListener('click', function () { send(ta.value); });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); }
  });
  ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; });

  function setOpen(v) {
    state.open = v; save();
    wrap.classList.toggle('open', v);
    if (v) { render(); setTimeout(function () { ta.focus(); }, 50); }
  }

  /* ---------- рендер ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function render() {
    body.innerHTML = '';
    add('a', GREETING);
    state.messages.forEach(function (m) { add(m.role === 'user' ? 'u' : 'a', m.content); });
    var ended = state.status !== 'in_progress';
    if (!ended && state.buttons && state.buttons.length && !busy) {
      var box = document.createElement('div'); box.className = 'btns';
      state.buttons.forEach(function (b) {
        var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b;
        btn.addEventListener('click', function () { send(b); });
        box.appendChild(btn);
      });
      body.appendChild(box);
    }
    if (ended) {
      var r = document.createElement('button'); r.className = 'restart'; r.type = 'button';
      r.textContent = 'Розпочати нову розмову';
      r.addEventListener('click', function () { state = fresh(); state.open = true; save(); render(); });
      body.appendChild(r);
    }
    ta.disabled = ended || busy; sendBtn.disabled = ended || busy;
    ta.placeholder = ended ? 'Розмову завершено' : 'Надіслати повідомлення...';
    scroll();
  }
  function add(cls, text) {
    var d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text; body.appendChild(d); return d;
  }
  function scroll() { body.scrollTop = body.scrollHeight; }

  /* ---------- відправка ---------- */
  function send(text) {
    text = String(text || '').trim();
    if (!text || busy || state.status !== 'in_progress') { return; }
    if (text.length > 1000) { text = text.slice(0, 1000); }
    state.messages.push({ role: 'user', content: text });
    state.buttons = []; save();
    ta.value = ''; ta.style.height = 'auto';
    busy = true; render();
    var typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(typing); scroll();

    var payload = { session_id: state.session_id, site: SITE, page: location.href, messages: state.messages.slice(-60) };
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
      .then(function (d) {
        if (!d || typeof d.reply !== 'string') { throw new Error('bad response'); }
        state.messages.push({ role: 'assistant', content: d.reply });
        state.buttons = Array.isArray(d.buttons) ? d.buttons.slice(0, 4).map(String) : [];
        state.status = d.status && d.status !== 'in_progress' ? d.status : 'in_progress';
        busy = false; save(); render();
      })
      .catch(function () {
        state.messages.pop();
        busy = false; save(); render();
        var e = add('err', 'Не вдалося надіслати повідомлення. Перевірте інтернет і спробуйте ще раз.');
        ta.value = text; scroll();
      });
  }

  function mount() {
    document.body.appendChild(host);
    if (state.open) { setOpen(true); }
  }
  if (document.body) { mount(); } else { document.addEventListener('DOMContentLoaded', mount); }
})();
