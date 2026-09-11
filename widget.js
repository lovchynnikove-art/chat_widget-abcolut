/* АбсолютМед, віджет реєстратури: чат з Олею + форма швидкого запису. Ставиться одним тегом:
   <script src="widget.js" data-color="#0077b3" data-site="absolutmed.lviv.ua"></script>
   Необов'язкові атрибути: data-endpoint (чат), data-form-endpoint (форма), data-title.
   Даних у скрипті немає: промпт, довідник, пороги і ціни живуть в n8n. */
(function () {
  'use strict';
  if (window.__absolutmedChatLoaded) { return; }
  window.__absolutmedChatLoaded = true;

  var script = document.currentScript;
  var ds = (script && script.dataset) || {};
  var ENDPOINT = ds.endpoint || 'https://n8n.businessautomation.space/webhook/absolutmed-chat';
  var FORM_ENDPOINT = ds.formEndpoint || 'https://n8n.businessautomation.space/webhook/absolutmed-form';
  var COLOR = ds.color || '#0077b3';
  var SITE = ds.site || location.hostname;
  var TITLE = ds.title || 'Онлайн-чат АбсолютМед';
  var STORE_KEY = 'absolutmed_chat_v1';
  var FORM_KEY = 'absolutmed_form_v1';
  var TTL_MS = 6 * 3600 * 1000;

  var GREETING = 'Доброго дня! Медичний центр Абсолют, мене звати Оля, я віртуальний асистент реєстратури. Листування зберігається і передається реєстратурі. Скажіть, будь ласка, чим можу допомогти?';
  var START_BUTTONS = ['Записатися на МРТ', 'Записатися на КТ', 'Ціни та підготовка'];
  var FORM_BUTTON = 'Заповнити форму запису';
  var CONSENT = 'Надсилаючи повідомлення, ви погоджуєтесь на обробку персональних даних медичним центром для запису на обстеження.';

  var state = load();

  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.session_id && (Date.now() - (s.updated || 0)) < TTL_MS) { if (!s.mode) { s.mode = 'chat'; } return s; }
      }
    } catch (e) {}
    return fresh();
  }
  function fresh() {
    return { session_id: uid(), messages: [], status: 'in_progress', buttons: START_BUTTONS.slice(), open: false, mode: 'chat', updated: Date.now() };
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
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- розмітка ---------- */
  var host = document.createElement('div');
  host.id = 'absolutmed-chat';
  var root = host.attachShadow({ mode: 'open' });

  var css = ''
    + ':host{all:initial}'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + '.am{position:fixed;right:20px;bottom:20px;z-index:2147483000;font:15px/1.45 -apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif;color:#1c2430}'
    + '.launch{display:flex;flex-direction:column;align-items:flex-end;gap:10px}'
    + '.am-btn{width:60px;height:60px;border-radius:50%;border:0;background:' + COLOR + ';color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;transition:transform .15s}'
    + '.am-btn:hover{transform:scale(1.06)}'
    + '.am-btn svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + '.am-pill{border:0;border-radius:30px;background:#fff;color:' + COLOR + ';font:inherit;font-weight:600;font-size:14px;padding:10px 16px 10px 12px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);display:flex;align-items:center;gap:8px;border:1.5px solid ' + COLOR + '}'
    + '.am-pill:hover{background:' + COLOR + ';color:#fff}'
    + '.am-pill svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + '.am-panel{position:absolute;right:0;bottom:0;width:380px;max-width:calc(100vw - 40px);height:620px;max-height:calc(100vh - 40px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}'
    + '.am.open .am-panel{display:flex}'
    + '.am.fm .am-panel{width:560px;height:860px}'
    + '.am.open .launch{display:none}'
    + '.am-head{background:' + COLOR + ';color:#fff;padding:12px 14px 12px 16px;display:flex;align-items:center;gap:10px}'
    + '.am-head .t{font-weight:600;font-size:16px}'
    + '.am-head .s{font-size:12px;opacity:.85}'
    + '.am-head .sw{margin-left:auto;background:rgba(255,255,255,.18);border:0;color:#fff;font:inherit;font-size:12px;padding:6px 10px;border-radius:14px;cursor:pointer;white-space:nowrap}'
    + '.am-head .sw:hover{background:rgba(255,255,255,.3)}'
    + '.am-head .x{background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 4px}'
    + '.am-body{flex:1;overflow-y:auto;padding:14px 12px;background:#f3f5f8;display:flex;flex-direction:column;gap:8px}'
    + '.m{max-width:85%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}'
    + '.m.a{align-self:flex-start;background:#fff;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '.m.u{align-self:flex-end;background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px}'
    + '.m.err{align-self:center;background:#fff3f3;color:#9b1c1c;font-size:13px;text-align:center}'
    + '.btns{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:90%}'
    + '.btns button{border:1.5px solid ' + COLOR + ';color:' + COLOR + ';background:#fff;border-radius:18px;padding:7px 13px;font:inherit;font-size:14px;cursor:pointer}'
    + '.btns button:hover{background:' + COLOR + ';color:#fff}'
    + '.btns button.alt{border-style:dashed}'
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
    /* форма */
    + '.f{display:flex;flex-direction:column;gap:12px;font-size:14px}'
    + '.f .note103{background:#fff8e6;border:1px solid #f3dfae;color:#6b4e00;border-radius:10px;padding:8px 10px;font-size:12.5px}'
    + '.f h4,.done h4{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7a8594;margin-top:8px}'
    + '.fld .l{font-size:13.5px;font-weight:600;color:#2b3440;margin-bottom:6px}'
    + '.fld .opt{font-weight:400;color:#9aa4b1;font-size:12px}'
    + '.f input[type=text],.f input[type=tel],.f select{width:100%;border:1.5px solid #d5dae2;border-radius:12px;padding:11px 13px;font:inherit;font-size:15px;background:#fff;outline:none;color:#1c2430;-webkit-appearance:none;appearance:none}'
    + '.two{display:flex;gap:10px}.two .fld{flex:1;min-width:0}'
    + '.agew{display:flex;align-items:center;gap:10px}.agew input{width:96px!important;text-align:center;font-size:17px!important}.agew span{color:#5b6675;font-size:14px}'
    + '.f select{background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%237a8594%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:18px;padding-right:38px}'
    + '.f input:focus,.f select:focus{border-color:' + COLOR + ';box-shadow:0 0 0 3px rgba(0,0,0,.05)}'
    + '.f input::placeholder{color:#a9b2bd}'
    + '.chips{display:flex;flex-wrap:wrap;gap:8px}'
    + '.chips button{border:1.5px solid #d5dae2;background:#fff;border-radius:22px;padding:9px 14px;font:inherit;font-size:14px;cursor:pointer;color:#1c2430;line-height:1.2}'
    + '.chips button:hover{border-color:' + COLOR + '}'
    + '.chips button.on{border-color:' + COLOR + ';background:' + COLOR + ';color:#fff}'
    + '.chips.seg button{flex:1;min-width:0;border-radius:12px;text-align:center}'
    + '.sub2{margin-top:10px;padding:10px 12px 12px;background:#eef3f8;border-left:3px solid ' + COLOR + ';border-radius:0 12px 12px 0}'
    + '.sub2 .sl{font-size:12px;color:#5b6675;margin:0 0 8px}.sub2 .sl b{color:#1c2430;font-weight:600}'
    + '.sub2 .chips{gap:6px}.sub2 .chips button{font-size:13px;padding:7px 12px;border-radius:16px;background:#fff;border-color:#c9d3df}'
    + '.sub2 .chips button.on{background:' + COLOR + ';border-color:' + COLOR + '}'
    + '.swr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#fff;border:1px solid #e6e9ee;border-radius:12px;cursor:pointer;line-height:1.3}'
    + '.switch{position:relative;flex:none;width:44px;height:26px}'
    + '.switch input{opacity:0;width:0;height:0;position:absolute}'
    + '.switch i{position:absolute;inset:0;background:#cfd5dd;border-radius:26px;transition:background .15s}'
    + '.switch i:before{content:"";position:absolute;width:22px;height:22px;left:2px;top:2px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}'
    + '.switch input:checked+i{background:' + COLOR + '}'
    + '.switch input:checked+i:before{transform:translateX(18px)}'
    + '.chk{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid #e6e9ee;border-radius:12px;cursor:pointer;line-height:1.35}'
    + '.chk input{margin-top:2px;flex:none;width:18px;height:18px;accent-color:' + COLOR + '}'
    + '.f .hint{font-size:12px;color:#7a8594;margin-top:6px}'
    + '.fld .fe{margin-top:6px;font-size:12.5px;color:#c0392b}'
    + '.fld.invalid .l{color:#c0392b}'
    + '.fld.invalid input,.fld.invalid select{border-color:#e05a4e}'
    + '.fld.invalid .chips button:not(.on){border-color:#f0b4ae}'
    + '.fld.invalid .chk{border-color:#e05a4e}'
    + '.f .submit{border:0;border-radius:12px;background:' + COLOR + ';color:#fff;font:inherit;font-weight:600;font-size:16px;padding:14px;cursor:pointer;margin-top:4px}'
    + '.f .submit:disabled{opacity:.6;cursor:default}'
    + '.done{display:flex;flex-direction:column;gap:10px;font-size:14px}'
    + '.done .ok{background:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '.done .ok b{display:block;font-size:16px;margin-bottom:6px;color:' + COLOR + '}'
    + '.done .esc{background:#fff8e6;border:1px solid #f3dfae;color:#6b4e00;border-radius:10px;padding:8px 10px}'
    + '.done p{background:#fff;border-radius:12px;padding:10px 13px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '@media (max-width:640px){.am{right:0;bottom:0}.launch{margin:0 16px 16px 0}'
    + '.am .am-panel,.am.fm .am-panel{position:fixed;left:0;top:0;right:0;bottom:0;width:100vw;max-width:100vw;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;box-shadow:none}'
    + '.am-head{padding-top:max(14px,env(safe-area-inset-top))}}'

  var ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 1 1 21 12z"/></svg>';
  var ICON_FORM = '<svg viewBox="0 0 24 24"><path d="M9 5h6M9 3h6v4H9zM5 6h1v15h12V6h1"/><path d="M8 12h8M8 16h5"/></svg>';

  root.innerHTML = '<style>' + css + '</style>'
    + '<div class="am">'
    + '<div class="launch">'
    + '<button class="am-pill" data-mode="form" aria-label="Швидкий запис">' + ICON_FORM + 'Швидкий запис</button>'
    + '<button class="am-btn" data-mode="chat" aria-label="Відкрити чат">' + ICON_CHAT + '</button>'
    + '</div>'
    + '<div class="am-panel" role="dialog" aria-label="' + esc(TITLE) + '">'
    + '<div class="am-head"><div><div class="t">' + esc(TITLE) + '</div><div class="s">Оля, віртуальний асистент реєстратури</div></div>'
    + '<button class="sw" type="button"></button><button class="x" aria-label="Закрити">×</button></div>'
    + '<div class="am-body"></div>'
    + '<div class="am-foot"><div class="row"><textarea rows="1" placeholder="Надіслати повідомлення..." aria-label="Повідомлення"></textarea>'
    + '<button class="send" aria-label="Надіслати"><svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button></div>'
    + '<div class="consent">' + esc(CONSENT) + '</div></div>'
    + '</div></div>';

  var wrap = root.querySelector('.am');
  var body = root.querySelector('.am-body');
  var foot = root.querySelector('.am-foot');
  var head = root.querySelector('.am-head');
  var sw = root.querySelector('.sw');
  var ta = root.querySelector('textarea');
  var sendBtn = root.querySelector('.send');
  var busy = false;

  root.querySelector('.am-btn').addEventListener('click', function () { setMode('chat'); setOpen(true); });
  root.querySelector('.am-pill').addEventListener('click', function () { setMode('form'); setOpen(true); });
  root.querySelector('.x').addEventListener('click', function () { setOpen(false); });
  sw.addEventListener('click', function () { setMode(state.mode === 'chat' ? 'form' : 'chat'); render(); });
  sendBtn.addEventListener('click', function () { send(ta.value); });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); }
  });
  ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; });

  function setMode(m) { state.mode = m; save(); }
  function setOpen(v) {
    state.open = v; save();
    wrap.classList.toggle('open', v);
    if (v) { render(); if (state.mode === 'chat') { setTimeout(function () { ta.focus(); }, 50); } }
  }

  /* ---------- рендер ---------- */
  function render() {
    var isChat = state.mode === 'chat';
    wrap.classList.toggle('fm', !isChat);
    head.querySelector('.t').textContent = isChat ? TITLE : 'Швидкий запис';
    head.querySelector('.s').textContent = isChat ? 'Оля, віртуальний асистент реєстратури' : 'Заповніть один раз, оператор передзвонить';
    sw.textContent = isChat ? 'Форма запису' : 'Чат з Олею';
    foot.hidden = !isChat;
    body.innerHTML = '';
    if (isChat) { renderChat(); } else { renderForm(); }
  }

  function renderChat() {
    add('a', GREETING);
    state.messages.forEach(function (m) { add(m.role === 'user' ? 'u' : 'a', m.content); });
    var ended = state.status !== 'in_progress';
    if (!ended && !busy) {
      var box = document.createElement('div'); box.className = 'btns';
      (state.buttons || []).forEach(function (b) {
        var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b;
        btn.addEventListener('click', function () { send(b); });
        box.appendChild(btn);
      });
      if (!state.messages.length) {
        var fb = document.createElement('button'); fb.type = 'button'; fb.className = 'alt'; fb.textContent = FORM_BUTTON;
        fb.addEventListener('click', function () { setMode('form'); render(); });
        box.appendChild(fb);
      }
      if (box.children.length) { body.appendChild(box); }
    }
    if (ended) {
      var r = document.createElement('button'); r.className = 'restart'; r.type = 'button';
      r.textContent = 'Розпочати нову розмову';
      r.addEventListener('click', function () { var m = state.mode; state = fresh(); state.open = true; state.mode = m; save(); render(); });
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

  /* ---------- чат: відправка ---------- */
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
        add('err', 'Не вдалося надіслати повідомлення. Перевірте інтернет і спробуйте ще раз.');
        ta.value = text; scroll();
      });
  }

  /* ---------- форма швидкого запису ---------- */
  var formDone = null;   // відповідь сервера після успішної відправки
  var formBusy = false;

  function loadDraft() { try { return JSON.parse(sessionStorage.getItem(FORM_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveDraft(v) { try { sessionStorage.setItem(FORM_KEY, JSON.stringify(v)); } catch (e) {} }

  var ZONE_GROUPS = [
    ['Голова', ['Головний мозок', 'Гіпофіз', 'Орбіти', 'Пазухи носа', 'Вуха', 'Лицьовий скелет', 'Скронево-щелепні суглоби']],
    ['Хребет', ['Шийний відділ', 'Грудний відділ', 'Поперековий відділ', 'Крижі і куприк', 'Спинний мозок', 'Увесь хребет']],
    ['Суглоби', ['Плечовий суглоб', 'Ліктьовий суглоб', 'Кисть і зап’ясток', 'Кульшовий суглоб', 'Колінний суглоб', 'Гомілково-ступневий суглоб', 'Стопа']],
    ['Шия і груди', ['М’які тканини шиї', 'Органи грудної клітки', 'Грудні залози', 'Серце', 'Грудина і ключиці']],
    ['Живіт', ['Черевна порожнина', 'Печінка', 'Підшлункова залоза', 'Нирки', 'Наднирники', 'Жовчний міхур і протоки', 'Селезінка', 'Кишківник']],
    ['Таз', ['Органи малого таза', 'Простата', 'Матка й придатки', 'Сечовий міхур', 'Пряма кишка', 'Кістки таза']],
    ['Судини', ['Судини головного мозку', 'Судини шиї', 'Аорта', 'Судини ніг', 'Судини нирок', 'Вени']]
  ];
  var DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Будь-який день'];
  var DAY_FULL = { 'Пн': 'понеділок', 'Вт': 'вівторок', 'Ср': 'середа', 'Чт': 'четвер', 'Пт': 'п\'ятниця', 'Сб': 'субота', 'Будь-який день': 'будь-який день' };
  var PARTS = ['Зранку', 'До обіду', 'Після обіду', 'Ввечері'];

  function chips(name, opts, cls) {
    return '<div class="chips' + (cls ? ' ' + cls : '') + '" data-chips="' + name + '">' + opts.map(function (o) { return '<button type="button" data-val="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function fld(name, label, inner, ifs, opt) {
    return '<div class="fld" data-fld="' + name + '"' + (ifs ? ' data-if="' + ifs + '"' : '') + '>'
      + (label ? '<div class="l">' + label + (opt ? ' <span class="opt">необов\'язково</span>' : '') + '</div>' : '')
      + inner + '<div class="fe" hidden></div></div>';
  }
  function swRow(name, label, ifs) {
    return '<label class="swr"' + (ifs ? ' data-if="' + ifs + '"' : '') + '><span>' + label + '</span><span class="switch"><input type="checkbox" name="' + name + '"><i></i></span></label>';
  }

  function formHtml() {
    return '<form class="f" novalidate>'
      + '<div class="note103">Якщо це невідкладний стан (ознаки інсульту, тяжка травма, гострий біль у животі, кровотеча), не заповнюйте форму, а телефонуйте 103.</div>'
      + '<h4>Обстеження</h4>'
      + fld('modality', 'Яке обстеження', chips('modality', ['КТ', 'МРТ'], 'seg'))
      + fld('zone', 'Що обстежуємо', chips('zone_group', ZONE_GROUPS.map(function (g) { return g[0]; })) + '<div class="sub2" data-zone-sub hidden></div>')
      + fld('apparatus', 'Апарат МРТ', chips('apparatus', ['1,5 Тесла', '3 Тесла'], 'seg') + '<div class="hint">Не впевнені, пропустіть, оператор підбере</div>', 'mri', true)
      + fld('contrast', 'Контраст', chips('contrast', ['З контрастом', 'Без контрасту'], 'seg'))
      + '<h4>Пацієнт</h4>'
      + swRow('for_other', 'Записую іншу людину')
      + fld('age', 'Повних років', '<div class="agew"><input type="text" name="age" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="35" autocomplete="off"><span>років</span></div>')
      + fld('weight', 'Вага', chips('weight', ['До 100 кг', '100-120 кг', 'Понад 120 кг'], 'seg'))
      + fld('girth', 'Обхват тіла в найгрубшому місці при опущених руках', chips('girth', ['До 140 см', '140-160 см', 'Понад 160 см'], 'seg'), 'mri')
      + fld('knee', 'Обхват у ділянці коліна', chips('knee', ['До 45 см', '45-59 см', 'Понад 59 см'], 'seg'), 'mri knee')
      + '<h4 data-if="mri contrast ct">Відмітьте, якщо стосується</h4>'
      + swRow('implants', 'Металеві імпланти, стенти, пластини або осколки', 'mri')
      + swRow('implants_docs', 'На них є паспорт або довідка лікаря', 'mri implants')
      + swRow('pacemaker', 'Кардіостимулятор або дефібрилятор', 'mri')
      + swRow('lens', 'Імплантований кришталик ока', 'mri')
      + swRow('lens_recent', 'Операції на оці менше 3 місяців', 'mri lens')
      + swRow('cannot_lie', 'Важко лежати нерухомо 20-40 хвилин', 'mri')
      + swRow('claustro', 'Страх закритого простору', 'mri')
      + swRow('biopsy', 'Була біопсія простати', 'mri prostate')
      + swRow('biopsy_recent', 'Біопсія менше 7 тижнів тому', 'mri prostate biopsy')
      + swRow('primovist', 'Лікар призначив контраст Примовіст', 'mri liver')
      + fld('gfr', 'Аналіз на креатинін і ШКФ', chips('gfr', ['Немає', 'Є, ШКФ у нормі', 'Є, ШКФ низька'], 'seg') + '<div class="hint" data-gfr-hint></div>', 'contrast')
      + swRow('gfr_old', 'Аналізу більше 14 днів', 'contrast gfr_has')
      + swRow('anemia', 'Анемія, гемоглобін нижче 80', 'ct contrast')
      + swRow('lactation', 'Годую груддю', 'contrast')
      + swRow('pregnancy', 'Вагітність', 'ct')
      + fld('referral', 'Скерування від лікаря', chips('referral', ['Є', 'Немає'], 'seg'), 'referral')
      + '<h4>Коли зручно</h4>'
      + fld('day', 'День', chips('day', DAYS))
      + fld('part', 'Час', chips('part', PARTS), '', true)
      + '<h4>Контакт</h4>'
      + '<div class="two">'
      + fld('first_name', 'Ім’я', '<input type="text" name="first_name" autocomplete="given-name" maxlength="40" placeholder="Оксана">')
      + fld('last_name', 'Прізвище', '<input type="text" name="last_name" autocomplete="family-name" maxlength="40" placeholder="Шевченко">')
      + '</div>'
      + fld('phone', 'Телефон', '<input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="+380 __ ___ __ __" maxlength="19">')
      + fld('consent', '', '<label class="chk"><input type="checkbox" name="consent"><span>Погоджуюсь на обробку персональних даних для запису на обстеження</span></label>')
      + '<button type="submit" class="submit">Надіслати заявку</button>'
      + '<div class="hint" style="text-align:center">Оператор передзвонить і підтвердить час</div>'
      + '</form>';
  }

  function vals(form) {
    var v = {};
    form.querySelectorAll('.chips').forEach(function (c) { v[c.getAttribute('data-chips')] = c.getAttribute('data-value') || ''; });
    form.querySelectorAll('input[name],select[name]').forEach(function (i) { v[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
    return v;
  }
  function zoneText(v) {
    return v.zone_item || '';
  }
  function conds(v) {
    var z = zoneText(v).toLowerCase();
    var mri = v.modality === 'МРТ', ct = v.modality === 'КТ', contrast = v.contrast === 'З контрастом';
    return {
      mri: mri, ct: ct, contrast: contrast,
      knee: /колін/.test(z), prostate: /простат/.test(z), liver: /печінк/.test(z),
      implants: !!v.implants, lens: !!v.lens, biopsy: !!v.biopsy,
      gfr_has: v.gfr === 'Є, ШКФ у нормі' || v.gfr === 'Є, ШКФ низька',
      referral: ct || (mri && (!!v.pregnancy || (!!v.lactation && contrast)))
    };
  }
  function applyVisibility(form) {
    var v = vals(form), c = conds(v);
    form.querySelectorAll('[data-if]').forEach(function (el) {
      var keys = el.getAttribute('data-if').split(/\s+/);
      var show = el.tagName === 'H4' ? keys.some(function (k) { return c[k]; }) : keys.every(function (k) { return c[k]; });
      el.hidden = !show;
    });
    // підказка до ШКФ залежно від модальності
    var gh = form.querySelector('[data-gfr-hint]');
    if (gh) { gh.textContent = c.ct ? 'Низька для КТ: 52 мл/хв і менше' : c.mri ? 'Низька для МРТ: 32 мл/хв і менше' : ''; }
    // КТ не працює у вихідні і ввечері
    form.querySelectorAll('.chips[data-chips="day"] button').forEach(function (b) { b.hidden = c.ct && b.getAttribute('data-val') === 'Сб'; });
    form.querySelectorAll('.chips[data-chips="part"] button').forEach(function (b) { b.hidden = c.ct && b.getAttribute('data-val') === 'Ввечері'; });
    if (c.ct && v.day === 'Сб') { setChips(form.querySelector('.chips[data-chips="day"]'), ''); }
    if (c.ct && v.part === 'Ввечері') { setChips(form.querySelector('.chips[data-chips="part"]'), ''); }
    saveDraft(v);
  }
  function setChips(c, value) {
    if (!c) { return; }
    c.setAttribute('data-value', value || '');
    c.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-val') === value); });
    if (c.getAttribute('data-chips') === 'zone_group') { renderZoneSub(c.closest('form'), value); }
    var fldEl = c.closest('.fld'); if (fldEl && value) { clearErr(fldEl); }
  }
  function renderZoneSub(form, group) {
    var box = form.querySelector('[data-zone-sub]');
    var g = ZONE_GROUPS.filter(function (x) { return x[0] === group; })[0];
    var items = g ? g[1] : [];
    box.innerHTML = items.length ? '<div class="sl">Оберіть ділянку в групі <b>' + esc(group) + '</b></div>' + chips('zone_item', items) : '';
    box.hidden = !items.length;
  }
  function fillDraft(form, d) {
    if (d.zone_group) { setChips(form.querySelector('.chips[data-chips="zone_group"]'), d.zone_group); }
    Object.keys(d).forEach(function (k) {
      var c = form.querySelector('.chips[data-chips="' + k + '"]');
      if (c) { if (k !== 'zone_group') { setChips(c, d[k]); } return; }
      var i = form.querySelector('[name="' + k + '"]');
      if (!i) { return; }
      if (i.type === 'checkbox') { i.checked = !!d[k]; } else { i.value = d[k] == null ? '' : d[k]; }
    });
  }
  function formatPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.slice(0, 3) === '380') { d = d.slice(3); } else if (d.charAt(0) === '0') { d = d.slice(1); } else if (d.slice(0, 2) === '80') { d = d.slice(2); }
    d = d.slice(0, 9);
    var out = '+380';
    if (d.length) { out += ' ' + d.slice(0, 2); }
    if (d.length > 2) { out += ' ' + d.slice(2, 5); }
    if (d.length > 5) { out += ' ' + d.slice(5, 7); }
    if (d.length > 7) { out += ' ' + d.slice(7, 9); }
    return d.length ? out : '';
  }

  function setErr(form, name, msg) {
    var el = form.querySelector('.fld[data-fld="' + name + '"]');
    if (!el) { return; }
    el.classList.add('invalid');
    var fe = el.querySelector('.fe'); fe.hidden = false; fe.textContent = msg;
  }
  function clearErr(el) { el.classList.remove('invalid'); var fe = el.querySelector('.fe'); if (fe) { fe.hidden = true; fe.textContent = ''; } }
  function validate(form, v) {
    var c = conds(v), e = {};
    if (!v.modality) { e.modality = 'Оберіть КТ або МРТ'; }
    if (!zoneText(v)) { e.zone = v.zone_group ? 'Оберіть ділянку' : 'Оберіть групу, потім ділянку'; }
    if (!v.contrast) { e.contrast = 'Оберіть, з контрастом чи без'; }
    if (!v.age) { e.age = 'Вкажіть вік'; } else if (+v.age < 0 || +v.age > 120) { e.age = 'Перевірте вік'; }
    if (!v.weight) { e.weight = 'Оберіть вагу'; }
    if (c.mri && !v.girth) { e.girth = 'Оберіть обхват'; }
    if (c.mri && c.knee && !v.knee) { e.knee = 'Оберіть обхват коліна'; }
    if (c.contrast && !v.gfr) { e.gfr = 'Оберіть варіант'; }
    if (c.referral && !v.referral) { e.referral = 'Є скерування чи немає?'; }
    if (!v.day) { e.day = 'Оберіть день'; }
    if (!v.first_name) { e.first_name = 'Вкажіть ім’я'; }
    if (!v.last_name) { e.last_name = 'Вкажіть прізвище'; }
    if (!/^\+380 \d{2} \d{3} \d{2} \d{2}$/.test(v.phone)) { e.phone = 'Введіть повний номер'; }
    if (!v.consent) { e.consent = 'Без згоди заявку надіслати не можна'; }
    if (v.age && +v.age < 18 && c.contrast) { e.contrast = 'Дітям до 18 років обстеження з контрастною речовиною, і КТ, і МРТ, ми не проводимо. Оберіть «Без контрасту», а потребу в контрасті вирішить лікар'; }
    return e;
  }

  function renderForm() {
    if (formDone) { renderDone(); return; }
    body.innerHTML = formHtml();
    var form = body.querySelector('form');
    fillDraft(form, loadDraft());
    applyVisibility(form);

    form.addEventListener('click', function (e) {
      var b = e.target.closest('.chips button');
      if (!b) { return; }
      var c = b.parentNode;
      var cur = c.getAttribute('data-value');
      var val = b.getAttribute('data-val');
      setChips(c, c.classList.contains('seg') ? val : (cur === val ? '' : val));
      applyVisibility(form);
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.name === 'phone') { var p = t.selectionEnd === t.value.length; t.value = formatPhone(t.value); }
      if (t.name === 'age') { t.value = t.value.replace(/\D/g, '').slice(0, 3); }
      var f = t.closest('.fld'); if (f && t.value) { clearErr(f); }
      applyVisibility(form);
    });
    form.addEventListener('change', function (e) {
      var f = e.target.closest('.fld'); if (f && (e.target.value || e.target.checked)) { clearErr(f); }
      applyVisibility(form);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formBusy) { return; }
      var v = vals(form);
      var errs = validate(form, v);
      form.querySelectorAll('.fld').forEach(clearErr);
      var keys = Object.keys(errs);
      if (keys.length) {
        keys.forEach(function (k) { setErr(form, k, errs[k]); });
        var first = form.querySelector('.fld.invalid');
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        var inp = first.querySelector('input:not([type=checkbox]),select'); if (inp) { inp.focus({ preventScroll: true }); }
        return;
      }
      formBusy = true;
      var btn = form.querySelector('.submit'); btn.disabled = true; btn.textContent = 'Надсилаю...';
      var payload = {
        session_id: 'fm-' + uid().slice(3), site: SITE, page: location.href,
        modality: v.modality, zone: zoneText(v), apparatus: v.apparatus, contrast: v.contrast.toLowerCase(),
        for_other: v.for_other, age: v.age, weight_band: v.weight, girth_band: v.girth, knee_band: v.knee,
        implants: v.implants, implants_docs: v.implants_docs, pacemaker: v.pacemaker, lens: v.lens, lens_recent: v.lens_recent,
        cannot_lie: v.cannot_lie, claustro: v.claustro, biopsy: v.biopsy, biopsy_recent: v.biopsy_recent, primovist: v.primovist,
        gfr_status: v.gfr, gfr_old: v.gfr_old, anemia: v.anemia, lactation: v.lactation, pregnancy: v.pregnancy,
        referral: v.referral.toLowerCase(),
        preferred_time: DAY_FULL[v.day] + (v.part ? ', ' + v.part.toLowerCase() : ''),
        name: v.first_name + ' ' + v.last_name, first_name: v.first_name, last_name: v.last_name,
        phone: v.phone, consent: v.consent
      };
      fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (x) {
          formBusy = false;
          if (x.status === 200 && x.d && x.d.ok) { formDone = x.d; try { sessionStorage.removeItem(FORM_KEY); } catch (e2) {} render(); return; }
          var msg = (x.d && x.d.errors && x.d.errors.length) ? x.d.errors.join('. ') : 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть у чат.';
          setErr(form, 'consent', msg); btn.disabled = false; btn.textContent = 'Надіслати заявку';
        })
        .catch(function () {
          formBusy = false;
          setErr(form, 'consent', 'Не вдалося надіслати заявку. Перевірте інтернет і спробуйте ще раз.');
          btn.disabled = false; btn.textContent = 'Надіслати заявку';
        });
    });
  }

  function renderDone() {
    var d = formDone;
    var h = '<div class="done"><div class="ok"><b>Дякуємо' + (d.name ? ', ' + esc(d.name) : '') + '. Заявку передано реєстратурі.</b>' + esc(d.closing || '') + '</div>';
    if (d.escalation) { h += '<div class="esc">З цим питанням має розібратися наш лікар. Радіолог зателефонує вам.</div>'; }
    (d.notes || []).forEach(function (n) { h += '<p>' + esc(n) + '</p>'; });
    if ((d.preparation || []).length) { h += '<h4>Підготовка</h4>'; }
    (d.preparation || []).forEach(function (p) { h += '<p>' + esc(p) + '</p>'; });
    h += '<button type="button" class="restart">Заповнити ще одну заявку</button></div>';
    body.innerHTML = h;
    body.querySelector('.restart').addEventListener('click', function () { formDone = null; render(); });
    body.scrollTop = 0;
  }

  function mount() {
    document.body.appendChild(host);
    if (state.open) { setOpen(true); }
  }
  if (document.body) { mount(); } else { document.addEventListener('DOMContentLoaded', mount); }
})();
