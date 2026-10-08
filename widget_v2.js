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
  // 07.10: форма 2.0 (ділянки й пороги головної Олі) — свій вебхук; стара форма /absolutmed-form лишилась для widget.js.
  var FORM_ENDPOINT = ds.formEndpoint || 'https://n8n.businessautomation.space/webhook/absolutmed-form2';
  var COLOR = ds.color || '#0077b3';
  var SITE = ds.site || location.hostname;
  var TITLE = ds.title || 'Онлайн-чат АбсолютМед';
  var BRAND = ds.brand || 'АбсолютМед';
  var STORE_KEY = 'absolutmed_chat_v1';
  var FORM_KEY = 'absolutmed_form_v3';
  var TTL_MS = 6 * 3600 * 1000;

  var GREETING = 'Доброго дня! Медичний центр Абсолют, мене звати Оля, я віртуальний асистент реєстратури. Листування зберігається і передається реєстратурі. Скажіть, будь ласка, чим можу допомогти?';
  // Найчастіші запити з аналізу вхідних дзвінків 25-29.09, з тих, що чат закриває сам.
  var START_BUTTONS = ['Записатися на обстеження', 'Скільки коштує', 'Чи потрібне скерування', 'Які аналізи потрібні', 'Як до вас доїхати'];
  var FORM_BUTTON = 'Швидкий запис';
  var CONSENT = 'Надсилаючи повідомлення, ви погоджуєтесь з обробкою персональних даних.';

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
    return { session_id: uid(), messages: [], status: 'in_progress', closed: '', buttons: START_BUTTONS.slice(), open: false, mode: 'chat', booking: null, escalated: false, chas: {}, taken: false, handoff: false, updated: Date.now() };
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
    + '.am-head{background:' + COLOR + ';color:#fff;padding:12px 12px 12px 14px;display:flex;align-items:center;gap:10px}'
    + '.am-head .av{position:relative;flex:none;width:38px;height:38px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}'
    + '.am-head .av svg{width:20px;height:20px;fill:none;stroke:' + COLOR + ';stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + '.am-head .av i{position:absolute;right:0;bottom:0;width:10px;height:10px;border-radius:50%;background:#34c759;border:2px solid ' + COLOR + '}'
    + '.am-head .tt{min-width:0;display:flex;flex-direction:column;line-height:1.2}'
    + '.am-head .t{font-weight:700;font-size:16px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.am-head .s{font-size:12px;opacity:.82;margin-top:2px;white-space:nowrap}'
    + '.am-head .sw{margin-left:auto;background:rgba(255,255,255,.18);border:0;color:#fff;font:inherit;font-size:12px;padding:6px 10px;border-radius:14px;cursor:pointer;white-space:nowrap}'
    + '.am-head .sw:hover{background:rgba(255,255,255,.3)}'
    + '.am-head .x{background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 4px}'
    + '.am-head .rs{background:transparent;border:0;cursor:pointer;width:30px;height:30px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center}'
    + '.am-head .rs:hover{background:rgba(255,255,255,.18)}'
    + '.am-head .rs svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + '.am-body{flex:1;overflow-y:auto;padding:14px 12px;background:#f3f5f8;display:flex;flex-direction:column;gap:8px}'
    + '.m{max-width:85%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}'
    + '.m.a{align-self:flex-start;background:#fff;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '.m.u{align-self:flex-end;background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px}'
    + '.m.err{align-self:center;background:#fff3f3;color:#9b1c1c;font-size:13px;text-align:center}'
    + '.m.a.op{background:#eef6ff;border:1px solid #cfe3f7}'
    + '.m .who{display:block;font-size:11px;font-weight:600;color:#1f5f99;margin-bottom:2px}'
    + '.opbar{align-self:center;font-size:12px;color:#1f5f99;background:#eef6ff;border-radius:10px;padding:4px 10px}'
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
    + '.consent{font-size:9.5px;color:#a3acb8;margin-top:7px;line-height:1.3;text-align:center;white-space:nowrap;overflow:hidden;letter-spacing:-.01em}'
    + '@media (max-width:380px){.consent{white-space:normal}}'
    + '.restart{align-self:center;margin-top:4px;border:0;background:transparent;color:' + COLOR + ';text-decoration:underline;cursor:pointer;font:inherit;font-size:14px}'
    /* форма */
    + '.f{display:flex;flex-direction:column;gap:12px;font-size:14px}'
    + '.f .note103{background:#fff8e6;border:1px solid #f3dfae;color:#6b4e00;border-radius:10px;padding:8px 10px;font-size:12.5px}'
    + '.f h4,.done h4{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7a8594;margin-top:8px}'
    + '.fld .l{font-size:13.5px;font-weight:600;color:#2b3440;margin-bottom:6px}'
    + '.fld .opt{font-weight:400;color:#9aa4b1;font-size:12px}'
    + '.f input[type=date]{cursor:pointer}'
    + '.f input[type=text],.f input[type=tel],.f input[type=date],.f input[type=time],.f select{width:100%;border:1.5px solid #d5dae2;border-radius:12px;padding:11px 13px;font:inherit;font-size:15px;background:#fff;outline:none;color:#1c2430;-webkit-appearance:none;appearance:none}'
    + '.two{display:flex;gap:10px}.two .fld{flex:1;min-width:0}'
    // 07.10: атрибут hidden має перемагати display:flex рядків (.swr, .two), інакше залежні рядки й кроки видно завжди.
    + '[hidden]{display:none!important}'
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
    + '.tgs{display:flex;flex-wrap:wrap;gap:6px}'
    + '.tg{position:relative;display:inline-flex;align-items:center;gap:6px;border:1.5px solid #d5dae2;border-radius:18px;padding:7px 12px;font-size:13px;line-height:1.2;cursor:pointer;background:#fff;color:#1c2430;user-select:none}'
    + '.tg input{position:absolute;opacity:0;width:0;height:0}'
    + '.tg:before{content:"+";font-weight:700;color:#9aa4b1}'
    + '.tg:hover{border-color:' + COLOR + '}'
    + '.tg.on{background:' + COLOR + ';border-color:' + COLOR + ';color:#fff}'
    + '.tg.on:before{content:"\\2713";color:#fff}'
    + '.tgblock .hint{margin:-2px 0 10px}'
    + '.grp{background:#fff;border:1px solid #e6e9ee;border-radius:14px;margin-top:10px;overflow:hidden}'
    + '.grp .gt{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#7a8594;padding:10px 12px 4px}'
    + '.grp .swr{border:0;border-radius:0;border-top:1px solid #eef1f5;padding:9px 12px;font-size:14px}'
    + '.grp .gt+.swr{border-top:0}'
    + '.grp .swr.dep{padding-left:26px;background:#f8fafc;font-size:13.5px}'
    + '.tpick{margin-top:12px}'
    + '.tpick .tl{font-size:12.5px;font-weight:600;color:#5b6675;margin-bottom:6px}'
    + '.tgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}'
    + '.tgrid button{border:1.5px solid #d5dae2;background:#fff;border-radius:10px;padding:7px 0;font:inherit;font-size:13.5px;cursor:pointer;color:#1c2430}'
    + '.tgrid button:hover{border-color:' + COLOR + '}'
    + '.tgrid button.on{background:' + COLOR + ';border-color:' + COLOR + ';color:#fff}'
    + '.next{margin-top:12px;border:1.5px solid ' + COLOR + ';background:#fff;color:' + COLOR + ';border-radius:12px;padding:9px 18px;font:inherit;font-weight:600;font-size:14px;cursor:pointer}'
    + '.next:hover{background:' + COLOR + ';color:#fff}'
    + '.f [data-step]{animation:am-in .25s ease}'
    + '@keyframes am-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'
    + '.chk{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid #e6e9ee;border-radius:12px;cursor:pointer;line-height:1.35}'
    + '.chk input{margin-top:2px;flex:none;width:18px;height:18px;accent-color:' + COLOR + '}'
    + '.f .hint{font-size:12px;color:#7a8594;margin-top:6px}'
    + '.apnote{background:#eef6fb;border:1px solid #cfe3f0;color:#1f4a66;border-radius:10px;padding:8px 10px;font-size:13px;margin-top:8px}'
    + '.agestop{background:#fff4f2;border:1px solid #f3cbc4;color:#7a2a1d;border-radius:10px;padding:8px 10px;font-size:13px;margin-top:10px}'
    + '.chips button:disabled{opacity:.4;cursor:not-allowed}'
    + '.exact{display:flex;align-items:center;gap:10px;margin-top:8px}.exact input{width:130px!important}.exact span{color:#5b6675;font-size:13px}'
    + '.done .booked{background:#e8f5ee;border:1px solid #bfe3cf;border-radius:12px;padding:12px 14px;margin:12px 0;font-size:14px}'
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
    + '.done p{background:#fff;border-radius:12px;padding:10px 13px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '@media (max-width:640px){.am{right:0;bottom:0;-webkit-text-size-adjust:100%;text-size-adjust:100%}.launch{margin:0 16px 16px 0}'
    + '.am .am-panel,.am.fm .am-panel{position:fixed;left:0;top:0;right:0;bottom:auto;width:100%;max-width:100%;height:100vh;height:100dvh;max-height:none;border-radius:0;box-shadow:none;overscroll-behavior:contain}'
    + '.am-head{padding-top:max(14px,env(safe-area-inset-top))}'
    /* iPhone: поле вводу зі шрифтом менше 16px Safari збільшує при фокусі, і чат «пливе» */
    + 'textarea,.f input[type=text],.f input[type=tel],.f input[type=date],.f input[type=time],.f select{font-size:16px}'
    + '.am-body{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}'
    + '.am-foot{padding-bottom:max(6px,env(safe-area-inset-bottom))}'
    + 'button{touch-action:manipulation}}'

  var ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 1 1 21 12z"/></svg>';
  var ICON_FORM = '<svg viewBox="0 0 24 24"><path d="M9 5h6M9 3h6v4H9zM5 6h1v15h12V6h1"/><path d="M8 12h8M8 16h5"/></svg>';
  var ICON_RESET = '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.64-6.36"/><path d="M3 3v6h6"/></svg>';

  root.innerHTML = '<style>' + css + '</style>'
    + '<div class="am">'
    + '<div class="launch">'
    + '<button class="am-pill" data-mode="form" aria-label="Швидкий запис">' + ICON_FORM + 'Швидкий запис</button>'
    + '<button class="am-btn" data-mode="chat" aria-label="Відкрити чат">' + ICON_CHAT + '</button>'
    + '</div>'
    + '<div class="am-panel" role="dialog" aria-label="' + esc(TITLE) + '">'
    + '<div class="am-head"><div class="av">' + ICON_CHAT + '<i></i></div><div class="tt"><div class="t">' + esc(BRAND) + '</div><div class="s">Онлайн-чат</div></div>'
    + '<button class="sw" type="button"></button><button class="rs" type="button" aria-label="Почати спочатку" title="Почати спочатку">' + ICON_RESET + '</button><button class="x" aria-label="Закрити">×</button></div>'
    + '<div class="am-body"></div>'
    + '<div class="am-foot"><div class="row"><textarea rows="1" maxlength="1000" placeholder="Надіслати повідомлення..." aria-label="Повідомлення"></textarea>'
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
  root.querySelector('.rs').addEventListener('click', function () { resetAll(); });
  sw.addEventListener('click', function () { setMode(state.mode === 'chat' ? 'form' : 'chat'); render(); });
  sendBtn.addEventListener('click', function () { send(ta.value); });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); }
  });
  ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; });
  root.querySelector('.am-panel').addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); } });

  // Телефон (ширина до 640px): чат на весь екран тримається рівно у видимій області (visualViewport). Коли на iPhone
  // відкривається клавіатура або ховається панель браузера, шапка і поле вводу не «пливуть», а сайт під чатом не прокручується.
  var panel = root.querySelector('.am-panel');
  var vv = window.visualViewport || null;
  var pageLocked = false, pageOverflow = ['', ''];
  function isPhone() { return !!(window.matchMedia && window.matchMedia('(max-width:640px)').matches); }
  function fitPhone() {
    var on = wrap.classList.contains('open') && isPhone();
    if (on && vv) { panel.style.height = Math.round(vv.height) + 'px'; panel.style.top = Math.round(vv.offsetTop) + 'px'; }
    else { panel.style.height = ''; panel.style.top = ''; }
    var de = document.documentElement, bd = document.body;
    if (on && !pageLocked) {
      pageOverflow = [de.style.overflow, bd ? bd.style.overflow : ''];
      de.style.overflow = 'hidden'; if (bd) { bd.style.overflow = 'hidden'; }
      pageLocked = true;
    } else if (!on && pageLocked) {
      de.style.overflow = pageOverflow[0]; if (bd) { bd.style.overflow = pageOverflow[1]; }
      pageLocked = false;
    }
  }
  if (vv) { vv.addEventListener('resize', fitPhone); vv.addEventListener('scroll', fitPhone); }
  window.addEventListener('resize', fitPhone);
  window.addEventListener('orientationchange', fitPhone);

  function setMode(m) { state.mode = m; save(); }
  function setOpen(v) {
    state.open = v; save();
    wrap.classList.toggle('open', v);
    fitPhone();
    if (v) { render(); if (state.mode === 'chat') { setTimeout(function () { focusInput(false); }, 50); } }
    else { var lb = root.querySelector(state.mode === 'form' ? '.am-pill' : '.am-btn'); if (lb) { lb.focus(); } }
  }

  // Кнопка «Почати спочатку»: чат, форма і все збережене в sessionStorage.
  // resetEpoch відсікає відповіді на запити, надіслані до скидання.
  var resetEpoch = 0;
  function hasProgress() {
    if (state.messages.length || formDone) { return true; }
    var d = loadDraft();
    return Object.keys(d).some(function (k) { return d[k] !== '' && d[k] !== false && d[k] != null; });
  }
  function resetAll() {
    if (hasProgress() && typeof window.confirm === 'function' && !window.confirm('Почати спочатку? Розмову і заповнену форму буде очищено.')) { return; }
    var m = state.mode;
    resetEpoch++;
    state = fresh(); state.open = true; state.mode = m;
    busy = false;
    formDone = null; formBusy = false; formPreferred = '';
    try { sessionStorage.removeItem(FORM_KEY); } catch (e) {}
    ta.value = ''; ta.style.height = 'auto';
    save(); render();
    body.scrollTop = 0;
    if (m === 'chat') { setTimeout(function () { focusInput(false); }, 50); }
  }

  /* ---------- рендер ---------- */
  function render() {
    var isChat = state.mode === 'chat';
    wrap.classList.toggle('fm', !isChat);
    head.querySelector('.t').textContent = isChat ? BRAND : 'Швидкий запис';
    head.querySelector('.s').textContent = isChat ? 'Онлайн-чат' : 'Оператор передзвонить';
    head.querySelector('.av').innerHTML = (isChat ? ICON_CHAT : ICON_FORM) + '<i></i>';
    sw.textContent = isChat ? 'Швидкий запис' : 'Чат з Олею';
    foot.hidden = !isChat;
    body.innerHTML = '';
    if (isChat) { renderChat(); } else { renderForm(); }
  }

  function renderChat() {
    add('a', GREETING);
    state.messages.forEach(function (m) {
      if (m.from === 'operator') { addOperator(m.content); } else { add(m.role === 'user' ? 'u' : 'a', m.content); }
    });
    // Діалог прийняв оператор реєстратури: розмова триває, навіть якщо Оля вже попрощалась.
    // Оля передала розмову оператору, а він ще не взяв діалог: поле вводу теж відкрите, репліки пацієнта чекають оператора.
    var opText = state.taken ? 'Вам відповідає оператор реєстратури' : (state.handoff ? 'Розмову передано оператору реєстратури' : '');
    if (opText) { var bar = document.createElement('div'); bar.className = 'opbar'; bar.textContent = opText; body.appendChild(bar); }
    // 25.09: Оля попрощалась, але розмова не закривається: пацієнт може питати далі, як у помічника. Поле вводу відкрите,
    // «Розпочати нову розмову» лише пропонується.
    var ended = state.status !== 'in_progress' && !state.taken && !state.handoff;
    // Заявку на обстеження вже оформлено («done»): друге обстеження — у новій розмові, тож кнопку видно й тоді, коли пацієнт пише далі.
    var offerNew = ended || (state.closed === 'done' && !state.taken && !state.handoff);
    if (!busy) {
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
    if (offerNew) {
      var r = document.createElement('button'); r.className = 'restart'; r.type = 'button';
      r.textContent = 'Розпочати нову розмову';
      r.addEventListener('click', function () {
        var m = state.mode; resetEpoch++; busy = false; ta.value = ''; ta.style.height = 'auto';
        state = fresh(); state.open = true; state.mode = m; save(); render(); focusInput(false);
      });
      body.appendChild(r);
    }
    ta.disabled = busy; sendBtn.disabled = busy;
    ta.placeholder = 'Надіслати повідомлення...';
    // Згоду дано першим повідомленням — далі рядок не заважає.
    var cs = root.querySelector('.consent'); if (cs) { cs.hidden = state.messages.length > 0; }
    scroll();
  }
  function add(cls, text) {
    var d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text; body.appendChild(d); return d;
  }
  function addOperator(text) {
    var d = document.createElement('div'); d.className = 'm a op';
    var who = document.createElement('span'); who.className = 'who'; who.textContent = 'Оператор реєстратури';
    d.appendChild(who); d.appendChild(document.createTextNode(text)); body.appendChild(d); return d;
  }
  function scroll() { body.scrollTop = body.scrollHeight; }

  /* ---------- чат: відправка ---------- */
  // Після відповіді курсор повертається в поле вводу: на комп'ютері завжди, на телефоні тільки якщо пацієнт друкував,
  // щоб після натискання кнопки не вискакувала клавіатура.
  function focusInput(wasFocused) {
    if (ta.disabled || state.mode !== 'chat' || !state.open) { return; }
    var finePointer = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    if (wasFocused || finePointer) { ta.focus(); }
  }
  // Фрази, якими Оля передає розмову оператору в чаті (промпт чату, «Якщо пацієнт заперечує або нервує»); звіряє verify_prompts.py.
  var HANDOFF_RE = /відповість вам тут,? у чаті/i;
  // Оператор відпустив діалог: далі знову відповідає Оля, передача оператору знята.
  function setTaken(v) { if (state.taken && !v) { state.handoff = false; } state.taken = v; }
  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) { return; }
    if (text.length > 1000) { text = text.slice(0, 1000); }
    state.messages.push({ role: 'user', content: text });
    var prevButtons = state.buttons || [];
    state.buttons = []; save();
    ta.value = ''; ta.style.height = 'auto';
    var keepFocus = root.activeElement === ta;
    busy = true; render();
    var typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(typing); scroll();

    var ep = resetEpoch;
    // 08.10: без тайм-ауту пацієнт міг дивитись на «три крапки» хвилинами; бюджет ходу чату 2.0 — 90 с.
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ac ? setTimeout(function () { ac.abort(); }, 95000) : null;
    // closed: завершальний статус, з яким заявку вже передано (25.09): сервер не шле другу заявку, коли пацієнт просто пише далі.
    // anketa: модальність, ділянка, контраст, вік, вага, стать, ім'я з попередньої відповіді (25.09): з них сервер рахує ескалацію й анкету.
    // chas: бажаний час з попередньої відповіді (29.09), возиться так само, як anketa: чіткого запису немає, час перевіряє двигун 2.0.
    var payload = { session_id: state.session_id, site: SITE, page: location.href, messages: state.messages.slice(-60), escalated: !!state.escalated, chas: state.chas || {}, handoff: !!state.handoff, closed: state.closed || '', anketa: state.anketa || {} };
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac ? ac.signal : undefined })
      .then(function (r) { if (!r.ok) { var he = new Error('HTTP ' + r.status); he.server = true; throw he; } return r.json(); })
      .then(function (d) {
        if (timer) { clearTimeout(timer); }
        if (ep !== resetEpoch) { return; }
        if (!d || typeof d.reply !== 'string') { var be = new Error('bad response'); be.server = true; throw be; }
        // Діалог в оператора або передано оператору: Оля мовчить, відповідь оператора прийде опитуванням.
        if (typeof d.taken === 'boolean') { setTaken(d.taken); }
        if (d.reply) { state.messages.push({ role: 'assistant', content: d.reply }); }
        state.buttons = Array.isArray(d.buttons) ? d.buttons.map(function (b) { return String(b == null ? '' : b).trim().slice(0, 40); })
          .filter(function (b, i, a) { return b && a.indexOf(b) === i; }).slice(0, 6) : [];
        if (!d.operator) { state.status = d.status && d.status !== 'in_progress' ? d.status : 'in_progress'; }
        if (typeof d.closed === 'string') { state.closed = d.closed; }
        if (d.anketa && typeof d.anketa === 'object' && !Array.isArray(d.anketa)) { state.anketa = d.anketa; }
        // Бажаний час, як його зрозумів двигун 2.0: возимо назад наступним запитом, самі нічого не рахуємо.
        if (d.chas && typeof d.chas === 'object' && !Array.isArray(d.chas)) { state.chas = d.chas; }
        // Оля передала розмову оператору в чаті: для пацієнта розмова не закінчена, наступні репліки йдуть оператору з handoff.
        if (!d.operator && state.status === 'transfer' && state.messages.slice(-3).some(function (m) { return m.role === 'assistant' && !m.from && HANDOFF_RE.test(m.content); })) { state.handoff = true; }
        if (d.booking && d.booking.apparatus) { state.booking = d.booking; }
        // 25.09: ескалацію рахує сервер за відповідями пацієнта: виправлена відповідь її знімає, тому прапорець не «липне».
        if (typeof d.escalated === 'boolean') { state.escalated = d.escalated; }
        if (d.contrast === 'так' || d.contrast === 'ні') { state.contrast = d.contrast; }
        busy = false; save(); render(); focusInput(keepFocus);
      })
      .catch(function (err) {
        if (timer) { clearTimeout(timer); }
        if (ep !== resetEpoch) { return; }
        state.messages.pop();
        state.buttons = prevButtons;
        busy = false; save(); render();
        add('err', err && err.name === 'AbortError' ? 'Відповідь затримується. Надішліть, будь ласка, повідомлення ще раз.'
          : err && err.server ? 'Технічна помилка на нашому боці. Спробуйте, будь ласка, ще раз за хвилину.'
          : 'Не вдалося надіслати повідомлення. Перевірте інтернет і спробуйте ще раз.');
        if (!ta.value) { ta.value = text; }
        focusInput(keepFocus); scroll();
      });
  }

  /* ---------- форма швидкого запису ---------- */
  var formDone = null;   // відповідь сервера після успішної відправки
  var formBusy = false;
  var formPreferred = '';   // бажаний час, з яким пішла заявка: показуємо його на екрані подяки

  function loadDraft() {
    try {
      var d = JSON.parse(sessionStorage.getItem(FORM_KEY) || '{}') || {};
      if (d.__t && Date.now() - d.__t > TTL_MS) { return {}; }
      delete d.__t; return d;
    } catch (e) { return {}; }
  }
  function saveDraft(v) { try { v.__t = Date.now(); sessionStorage.setItem(FORM_KEY, JSON.stringify(v)); delete v.__t; } catch (e) {} }

  // ZONES-BEGIN
// Згенеровано chat_widget/forma_zony.py з прайсу Олі 2.0 (exams.json). Не правити руками.
// КТ: [група, [[підпис, код]]]; МРТ: [група, [[підпис, код 1,5 Тл, код 3 Тл]]] — порожній код: на цьому апараті не робимо.
  var FORM_ZONES = {"КТ":[["Голова",[["Головний мозок","10001"],["Головний мозок і другий шийний хребець","10002"],["Орбіти","10003"],["Придаткові пазухи носа","10004"],["Вуха (пірамідки скроневих кісток)","10005"],["Лицьовий скелет","10006"],["Перфузія головного мозку","10010"]]],["Хребет",[["Шийний відділ хребта","10101"],["Грудний відділ хребта","10102"],["Попереково-крижовий відділ хребта","10103"],["Крижовий відділ хребта і куприк","10104"]]],["Суглоби й кінцівки",[["Плечовий суглоб","10121"],["Ліктьовий суглоб","10122"],["Зап'ясток","10123"],["Плече","10124"],["Передпліччя","10125"],["Кисть","10126"],["Кульшові суглоби","10151"],["Колінні суглоби","10153"],["Гомілковостопні суглоби","10154"],["Стегна","10155"],["Гомілки","10156"],["Стопи","10157"]]],["Шия",[["М'які тканини шиї","10201"]]],["Груди й серце",[["Органи грудної клітки","10301"],["Кальцієвий індекс судин серця","10302"]]],["Живіт",[["Органи черевної порожнини","10401"],["Товста кишка (КТ-колоноскопія)","10410"],["Сечовидільна система, одинарне сканування","10601"],["Сечовидільна система, подвійне сканування","10602"]]],["Таз",[["Кістки таза","10152"],["Органи малого таза","10501"],["Калитка","10510"]]],["Судини",[["Судини головного мозку","10801"],["Судини шиї","10802"],["Судини серця (КТ-коронарографія)","10803"],["Грудна аорта","10804"],["Черевна аорта","10805"],["Судини нирок","10806"],["Судини таза","10807"],["Судини кінцівок, проксимальний відділ","10808"],["Судини кінцівок, дистальний відділ","10809"],["Вени, одна ділянка","10810"]]],["Інше",[["Денситометрія (щільність кісток)","10105"],["М'які тканини, одна ділянка","10110"]]]],"МРТ":[["Голова",[["Головний мозок","15001","30001"],["Головний мозок, дегенеративні зміни","15005","30005"],["Гіпофіз","15006","30006"],["Орбіти","15012","30012"],["Придаткові пазухи носа","15013","30013"],["Вуха (пірамідки скроневих кісток)","15014","30014"],["М'які тканини голови","15017","30017"],["Слинна залоза","","30015"],["Нерви головного мозку","","30016"],["Ліквородинаміка головного мозку","","30018"],["Скронево-нижньощелепні суглоби","","30120"]]],["Хребет",[["Шийний відділ хребта","15101","30101"],["Грудний відділ хребта","15102","30102"],["Попереково-крижовий відділ хребта","15103","30103"],["Крижовий відділ хребта","15104","30104"],["Спинний мозок, одна ділянка","15105","30105"]]],["Суглоби й кінцівки",[["Плечовий суглоб","15121","30121"],["Ліктьовий суглоб","15122","30122"],["Зап'ясток","15123","30123"],["Плече","15124","30124"],["Передпліччя","15125","30125"],["Кисть","15126","30126"],["Пальці кисті","15127","30127"],["Кульшові суглоби","15151","30151"],["Крижово-клубові суглоби","15152","30152"],["Колінний суглоб","15153","30153"],["Гомілковостопний суглоб","15154","30154"],["Стегно","15155","30155"],["Гомілка","15156","30156"],["Стопа або п'ятка","15157","30157"],["Пальці стопи","15158","30158"]]],["Шия",[["М'які тканини шиї","15202","30202"],["Гортань","15203","30203"]]],["Груди й серце",[["Серце","15301","30301"],["Грудні залози","15302","30302"],["Середостіння","15303","30303"],["Груднина","15305","30305"],["Органи грудної клітки","15306","30306"],["Ключиця","15307","30307"],["Суглоби ключиці","15308","30308"],["Лопатка","15309","30309"],["Грудна стінка","15310","30310"]]],["Живіт",[["Печінка","15401","30401"],["Жовчний міхур","15402","30402"],["Жовчні протоки (МРХПГ)","15403","30403"],["Підшлункова залоза","15404","30404"],["Селезінка","15405","30405"],["Надниркові залози","15406","30406"],["Нирки","15407","30407"],["Сечоводи","15409","30409"],["Тонкий кишечник (ентерографія)","15410","30410"],["Органи черевної порожнини","15411","30411"]]],["Таз",[["Простата","15501","30501"],["Калитка","15502","30502"],["Пеніс","15503","30503"],["Матка й придатки","15504","30504"],["Пряма кишка","15505","30505"],["Сигмовидна кишка","15506","30506"],["Товста кишка","15507","30507"],["Сечовий міхур","15508","30508"],["М'язи таза","15509","30509"],["Органи малого таза","15510","30510"],["Плід (вагітність)","15511","30511"]]],["Судини",[["Артерії головного мозку","15002","30002"],["Судини, одна ділянка","15108","30108"],["Судини шиї","15201","30201"],["Магістральні судини","15304","30304"],["Ниркові артерії","15408","30408"]]],["Інше",[["Нерви, одна ділянка","15106","30106"],["Нервове сплетіння, одна ділянка","15107","30107"]]]]};
  // ZONES-END
  // Адреси апаратів (resources.json Олі).
  var ADRESA = { 'КТ': 'вул. Юрія Руфа, 6', '1,5 Тесла': 'вул. Юрія Руфа, 6', '3 Тесла': 'вул. Костя Левицького, 55' };
  function zoneGroups(mod) { return FORM_ZONES[mod] || []; }
  // Ділянка в каталозі обраної модальності: [підпис, код] для КТ, [підпис, код 1,5, код 3] для МРТ.
  function zoneInfo(v) {
    var g = zoneGroups(v.modality).filter(function (x) { return x[0] === v.zone_group; })[0];
    return g ? (g[1].filter(function (it) { return it[0] === v.zone_item; })[0] || null) : null;
  }

  function chips(name, opts, cls) {
    return '<div class="chips' + (cls ? ' ' + cls : '') + '" data-chips="' + name + '">' + opts.map(function (o) { return '<button type="button" data-val="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  // step — крок покрокової форми (07.10): поле з'являється, коли заповнені всі попередні кроки.
  function fld(name, label, inner, ifs, opt, step) {
    return '<div class="fld" data-fld="' + name + '"' + (ifs ? ' data-if="' + ifs + '"' : '') + (step ? ' data-step="' + step + '"' : '') + '>'
      + (label ? '<div class="l">' + label + (opt ? ' <span class="opt">необов\'язково</span>' : '') + '</div>' : '')
      + inner + '<div class="fe" hidden></div></div>';
  }
  // Група пов'язаних тумблерів (07.10): картка з заголовком; видно, якщо підходить хоч одна умова зі списку any.
  // all — умова, що має виконатись повністю (напр. «mri prostate»: лише МРТ простати), замість any.
  function grp(title, any, rows, all) {
    return '<div class="grp"' + (all ? ' data-if="' + all + '"' : ' data-if-any="' + any + '"') + '><div class="gt">' + title + '</div>' + rows + '</div>';
  }
  // Компактна мітка замість рядка з перемикачем (07.10): усі разом, займають мало місця.
  function tg(name, label, ifs) {
    return '<label class="tg"' + (ifs ? ' data-if="' + ifs + '"' : '') + '><input type="checkbox" name="' + name + '"><span>' + label + '</span></label>';
  }
  function swRow(name, label, ifs, dep) {
    return '<label class="swr' + (dep ? ' dep' : '') + '"' + (ifs ? ' data-if="' + ifs + '"' : '') + '><span>' + label + '</span><span class="switch"><input type="checkbox" name="' + name + '"><i></i></span></label>';
  }

  // 07.10 (вказівка користувача): форма покрокова — спершу лише «Яке обстеження», далі кожне поле з'являється після
  // попереднього; перемикачі стану здоров'я — компактні мітки всі разом із кнопкою «Далі», щоб пропустити їх одним махом.
  function formHtml() {
    return '<form class="f" novalidate>'
      + '<div class="note103">Невідкладний стан (інсульт, тяжка травма, гострий біль у животі, кровотеча) — телефонуйте 103, а не заповнюйте форму.</div>'
      + '<h4 data-step="1">Обстеження</h4>'
      + fld('modality', 'Яке обстеження', chips('modality', ['КТ', 'МРТ'], 'seg'), '', false, 1)
      + fld('zone', 'Що обстежуємо', '<div data-zone-box></div><div class="sub2" data-zone-sub hidden></div>', '', false, 2)
      + fld('contrast', 'Контраст', chips('contrast', ['З контрастом', 'Без контрасту'], 'seg'), '', false, 3)
      + '<h4 data-step="4">Пацієнт</h4>'
      + fld('age', 'Повних років', '<div class="agew"><input type="text" name="age" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="35" autocomplete="off"><span>років</span></div>'
        + '<div class="agestop" data-age-note hidden></div>'
        + '<div style="margin-top:10px">' + swRow('for_other', 'Записую іншу людину') + '</div>', '', false, 4)
      + fld('weight', 'Вага', chips('weight', ['До 100 кг', '100-119 кг', 'Від 120 кг'], 'seg'), '', false, 5)
      + fld('girth', 'Обхват тіла в найгрубшому місці при опущених руках', chips('girth', ['До 140 см', '141-160 см', 'Понад 160 см'], 'seg'), 'girth_q', false, 6)
      + fld('knee', 'Обхват у ділянці коліна', chips('knee', ['До 45 см', '46-59 см', 'Понад 59 см'], 'seg'), 'mri knee', false, 7)
      + fld('apparatus', 'Апарат МРТ', chips('apparatus', ['1,5 Тесла', '3 Тесла'], 'seg') + '<div class="apnote" data-ap-note hidden></div><div class="hint" data-ap-hint></div>', 'mri', true, 8)
      + '<div class="fld tgblock" data-fld="toggles" data-if="tg_any" data-step="8">'
      + '<div class="l">Відмітьте, що стосується пацієнта</div>'
      + '<div class="hint">Якщо нічого з цього, просто натисніть «Далі»</div>'
      + grp('Пристрої в тілі', 'mri',
          swRow('pacemaker', 'Кардіостимулятор', 'mri') + swRow('defibrillator', 'Дефібрилятор', 'mri') + swRow('neurostimulator', 'Нейростимулятор', 'mri'))
      + grp('Метал в тілі', 'mri',
          swRow('stents', 'Стенти', 'mri') + swRow('joint_prosthesis', 'Суглобові протези', 'mri') + swRow('metal_fragments', 'Металеві осколки', 'mri')
          + swRow('implants', 'Інші металеві імпланти або пластини', 'mri') + swRow('implants_docs', 'Є паспорт або сертифікат на імпланти чи довідка лікаря', 'mri implants', true))
      + grp('Очі', 'mri',
          swRow('lens', 'Імплантований кришталик ока', 'mri') + swRow('lens_recent', 'Операція на оці менше 3 місяців тому', 'mri lens', true))
      + grp('Під час обстеження', 'mri',
          swRow('cannot_lie', 'Не зможу лежати нерухомо 20–40 хвилин', 'mri') + swRow('claustro', 'Страх закритого простору', 'mri'))
      + grp('Простата', '',
          swRow('biopsy', 'Була біопсія простати', 'mri prostate') + swRow('biopsy_recent', 'Біопсія менше 7 тижнів тому', 'mri prostate biopsy', true), 'mri prostate')
      + grp('Печінка', '', swRow('primovist', 'Лікар призначив контраст Примовіст', 'mri liver contrast'), 'mri liver contrast')
      + grp('Стан пацієнта', 'contrast preg',
          swRow('anemia', 'Анемія', 'ct contrast') + swRow('lactation', 'Годую груддю', 'contrast') + swRow('pregnancy', 'Вагітність', 'ct preg_age'))
      + '<input type="hidden" name="tg_done">'
      + '<button type="button" class="next" data-next="tg">Далі</button>'
      + '</div>'
      + fld('gfr', 'Аналіз на креатинін і ШКФ', '<div class="hint" data-gfr-need style="margin:0 0 8px"></div>'
        + chips('gfr', ['Немає', 'Є, ШКФ у нормі', 'Є, ШКФ низька'], 'seg') + '<div class="hint" data-gfr-hint></div>', 'contrast', false, 9)
      + fld('referral', 'Скерування від лікаря', chips('referral', ['Є', 'Немає'], 'seg'), 'referral', false, 10)
      + '<h4 data-step="11">Коли зручно</h4>'
      + fld('preferred_date', 'Бажаний день', '<input type="date" name="preferred_date" min="' + dayISO(0) + '" max="' + dayISO(60) + '"><div class="hint" data-day-name></div>', '', false, 11)
      + fld('preferred_part', 'Бажана частина дня', chips('day_part', DAY_PARTS)
        + '<div class="tpick" hidden><div class="tl">Точна година <span class="opt">необов\'язково</span></div><div class="tgrid" data-times></div></div>'
        + '<input type="hidden" name="exact_time">'
        + '<div class="hint">Точний час підтвердить оператор.</div>', '', false, 12)
      + '<h4 data-step="13">Контакт</h4>'
      + '<div class="two" data-step="13">'
      + fld('first_name', 'Ім’я', '<input type="text" name="first_name" autocomplete="given-name" maxlength="40" placeholder="Оксана">')
      + fld('last_name', 'Прізвище', '<input type="text" name="last_name" autocomplete="family-name" maxlength="40" placeholder="Шевченко">')
      + '</div>'
      + fld('phone', 'Телефон', '<input type="tel" name="phone" inputmode="tel" autocomplete="tel" placeholder="+380 __ ___ __ __" maxlength="19">', '', false, 14)
      + fld('consent', '', '<label class="chk"><input type="checkbox" name="consent"><span>Погоджуюсь на обробку персональних даних для запису на обстеження</span></label>', '', false, 15)
      + '<button type="submit" class="submit" data-step="15">Надіслати заявку</button>'
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
    var age = /^\d{1,3}$/.test(v.age || '') ? +v.age : null;
    // Вагітність — лише КТ і вік 16–45 (H_ANKETA vahitnist, rules.json vahitnist_vik_vid/do).
    var preg = ct && (age === null || (age >= 16 && age <= 45));
    return {
      mri: mri, ct: ct, contrast: contrast, preg_age: age === null || (age >= 16 && age <= 45), preg: preg,
      // Обхват тіла — лише МРТ і вага не до 100 кг (H_ANKETA obhvat).
      girth_q: mri && !!v.weight && v.weight !== 'До 100 кг',
      knee: /колін/.test(z), prostate: /простат/.test(z), liver: /печінк/.test(z),
      implants: !!(v.implants || v.stents || v.joint_prosthesis), lens: !!v.lens, biopsy: !!v.biopsy,
      gfr_has: v.gfr === 'Є, ШКФ у нормі' || v.gfr === 'Є, ШКФ низька',
      referral: ct || (mri && ((!!v.pregnancy && preg) || (!!v.lactation && contrast))),
      // Тумблери стану потрібні, лише коли є хоч один пункт анкети Олі для цього обстеження.
      tg_any: mri || contrast || preg
    };
  }
  // Бажаний час замість вибору слота (29.09): чіткого запису немає, можливість дня і години перевіряє двигун 2.0 на сервері.
  var DAY_PARTS = ['Зранку', 'В обід', 'Після обіду', 'Ввечері', 'Будь-коли'];
  // Точна година (07.10): кнопки з кроком 30 хвилин лише для обраної частини дня; «Будь-коли» — без годин.
  function halfHours(from, to) {
    var out = [];
    for (var m = from * 60; m <= to * 60; m += 30) { var h = Math.floor(m / 60), mm = m % 60; out.push((h < 10 ? '0' : '') + h + ':' + (mm ? '30' : '00')); }
    return out;
  }
  var TIME_RANGES = { 'Зранку': halfHours(8, 11.5), 'В обід': halfHours(12, 13.5), 'Після обіду': halfHours(14, 16.5), 'Ввечері': halfHours(17, 21) };
  // Межі поля дати: сьогодні і сьогодні плюс 60 днів, у форматі, який розуміє input type=date.
  function dayISO(plus) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + (plus || 0));
    var m = d.getMonth() + 1, n = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (n < 10 ? '0' + n : n);
  }
  // На сервер день іде як «дд.мм»: саме цей формат розуміє двигун бажаного часу.
  function ddmm(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? m[3] + '.' + m[2] : '';
  }
  // Точна година, якщо пацієнт її вписав, перемагає чипс частини дня.
  function partOfDay(v) { return v.exact_time || v.day_part || ''; }
  // Покрокова форма (07.10): номер першого незаповненого кроку; видно кроки до нього включно.
  var ageCommitted = false, nameCommitted = false, lastStep = 0;
  function stepReached(v, c) {
    var age = +v.age;
    var done = [
      !!v.modality,
      !!zoneText(v),
      !!v.contrast,
      /^\d{1,3}$/.test(v.age || '') && age >= 17 && age <= 120 && ((v.age || '').length >= 2 || ageCommitted),
      !!v.weight,
      !c.girth_q || !!v.girth,
      !(c.mri && c.knee) || !!v.knee,
      v.tg_done === '1' || !c.tg_any,
      !c.contrast || !!v.gfr,
      !c.referral || !!v.referral,
      !!v.preferred_date && v.preferred_date >= dayISO(0) && v.preferred_date <= dayISO(60),
      !!partOfDay(v),
      !!v.first_name && !!v.last_name && nameCommitted,
      /^\+380 \d{2} \d{3} \d{2} \d{2}$/.test(v.phone || '')
    ];
    for (var i = 0; i < done.length; i++) { if (!done[i]) { return i + 1; } }
    return done.length + 1;
  }
  function applyVisibility(form) {
    var v = vals(form), c = conds(v);
    var reached = stepReached(v, c);
    // Години для обраної частини дня; якщо частину дня змінили, а година з іншого проміжку — знімаємо її.
    var tbox = form.querySelector('[data-times]');
    if (tbox) {
      var rng = TIME_RANGES[v.day_part] || [];
      var et = form.querySelector('input[name="exact_time"]');
      if (et.value && rng.indexOf(et.value) === -1) { et.value = ''; v.exact_time = ''; }
      if (tbox.getAttribute('data-for') !== (v.day_part || '')) {
        tbox.setAttribute('data-for', v.day_part || '');
        tbox.innerHTML = rng.map(function (t) { return '<button type="button" data-time="' + t + '">' + t + '</button>'; }).join('');
      }
      tbox.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-time') === et.value); });
      tbox.parentNode.hidden = !rng.length;
    }
    form.querySelectorAll('[data-if-any]').forEach(function (el) {
      el.hidden = !el.getAttribute('data-if-any').split(/\s+/).some(function (k) { return c[k]; });
    });
    form.querySelectorAll('[data-if],[data-step]').forEach(function (el) {
      var ifs = el.getAttribute('data-if');
      var keys = ifs ? ifs.split(/\s+/) : [];
      var show = !keys.length || keys.every(function (k) { return c[k]; });
      var st = +(el.getAttribute('data-step') || 0);
      if (st && st > reached) { show = false; }
      el.hidden = !show;
    });
    // 08.10: тумблер, схований умовою (не кроком), знімається — інакше «Вагітність» з КТ їхала б у заявку МРТ.
    form.querySelectorAll('.swr[data-if]').forEach(function (l) {
      var i = l.querySelector('input');
      if (i && i.checked && !l.getAttribute('data-if').split(/\s+/).every(function (k) { return c[k]; })) { i.checked = false; v[i.name] = false; }
    });
    form.querySelectorAll('.tg').forEach(function (l) { var i = l.querySelector('input'); l.classList.toggle('on', !!(i && i.checked)); });
    // Група тумблерів без жодного видимого рядка — ховаємо (напр. «Стан пацієнта» для КТ без контрасту у 60 років).
    form.querySelectorAll('.grp').forEach(function (g) {
      if (g.hidden) { return; }
      g.hidden = ![].some.call(g.querySelectorAll('.swr'), function (r) { return !r.hidden; });
    });
    applyAparat(form, v, c);
    applyAge(form, v);
    // Новий крок з'явився — плавно показуємо його.
    if (reached > lastStep && lastStep) {
      var nx = null;
      form.querySelectorAll('[data-step]').forEach(function (el) { if (!nx && !el.hidden && +el.getAttribute('data-step') > lastStep) { nx = el; } });
      if (nx) { setTimeout(function () { nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30); }
    }
    lastStep = reached;
    // підказка до ШКФ залежно від модальності
    var gh = form.querySelector('[data-gfr-hint]');
    if (gh) { gh.textContent = c.ct ? 'Низька для КТ: 52 мл/хв і менше' : c.mri ? 'Низька для МРТ: 32 мл/хв і менше' : ''; }
    var dn = form.querySelector('[data-day-name]');
    if (dn) { var dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.preferred_date || ''); dn.textContent = dd ? ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'][new Date(+dd[1], +dd[2] - 1, +dd[3], 12).getDay()] : ''; }
    var gn = form.querySelector('[data-gfr-need]');
    if (gn) { gn.textContent = c.ct ? 'Перед обстеженням з контрастом потрібні аналізи на креатинін, сечовину і гемоглобін, не старші 14 днів.' : 'Перед обстеженням з контрастом потрібні аналізи на креатинін і сечовину, не старші 14 днів.'; }
    saveDraft(v);
  }
  // Апарат МРТ (07.10, за Олею h2KrokAparat): кнопки лише тих апаратів, на яких роблять ділянку; обхват тіла 141–160 см —
  // лише 3 Тесла, коліна 46–59 см — лише 1,5 Тесла; понад 160 / понад 59 або обидва в середині — апарат підбере оператор.
  function aparatRule(v, c) {
    if (!c.mri) { return null; }
    var zi = zoneInfo(v);
    var avail = zi ? [zi[1] ? '1,5 Тесла' : '', zi[2] ? '3 Тесла' : ''].filter(Boolean) : ['1,5 Тесла', '3 Тесла'];
    var gMid = c.girth_q && v.girth === '141-160 см', gHi = c.girth_q && v.girth === 'Понад 160 см';
    var kMid = c.knee && v.knee === '46-59 см', kHi = c.knee && v.knee === 'Понад 59 см';
    var r = { avail: avail, fix: '', op: false, say: '' };
    if (avail.length === 1) { r.fix = avail[0]; r.say = 'Це обстеження робимо тільки на апараті ' + avail[0] + ', ' + ADRESA[avail[0]] + '.'; }
    if (gHi || kHi || (gMid && kMid)) { r = { avail: avail, fix: '', op: true, say: 'Апарат підбере оператор.' }; }
    else if (gMid) { r.fix = '3 Тесла'; r.say = 'На апарат 1,5 Тесла обмеження до 140 сантиметрів, тому обстеження буде на апараті 3 Тесла, ' + ADRESA['3 Тесла'] + '.'; }
    else if (kMid) { r.fix = '1,5 Тесла'; r.say = 'На апарат 3 Тесла обмеження до 45 сантиметрів, тому обстеження буде на апараті 1,5 Тесла, ' + ADRESA['1,5 Тесла'] + '.'; }
    if (r.fix && avail.indexOf(r.fix) === -1) { r = { avail: avail, fix: '', op: true, say: 'Апарат підбере оператор.' }; }
    return r;
  }
  function applyAparat(form, v, c) {
    var box = form.querySelector('.chips[data-chips="apparatus"]');
    var hint = form.querySelector('[data-ap-hint]'), note = form.querySelector('[data-ap-note]');
    if (!box) { return; }
    var r = aparatRule(v, c);
    var cur = box.getAttribute('data-value') || '';
    var nv = cur;
    if (r && r.op) { nv = ''; } else if (r && r.fix) { nv = r.fix; } else if (r && cur && r.avail.indexOf(cur) === -1) { nv = ''; }
    if (nv !== cur) { setChips(box, nv); }
    box.querySelectorAll('button').forEach(function (b) {
      var val = b.getAttribute('data-val');
      b.hidden = !!r && r.avail.indexOf(val) === -1;
      b.disabled = !!r && (r.op || (!!r.fix && val !== r.fix));
    });
    // Підказка під апаратом: правило з ділянки (лише один апарат) або адреса обраного; правило з обхвату — окремою нотаткою.
    var zoneOnly = r && r.avail.length === 1;
    hint.textContent = zoneOnly ? r.say : (nv ? 'Апарат ' + nv + ': ' + ADRESA[nv] + '.' : 'Не впевнені — пропустіть, апарат підбере оператор.');
    var fromGirth = r && (r.op || (r.fix && !zoneOnly));
    note.hidden = !fromGirth;
    note.textContent = fromGirth ? r.say : '';
    if (fromGirth) { hint.textContent = ''; }   // адреса вже є у фразі про апарат
    if (c.mri) { v.apparatus = nv; }
  }
  // Вік (rules.json vik_min 18, vik_operator 17; фрази Олі dity_molodshi, dity_simnadtsiat).
  function applyAge(form, v) {
    var n = form.querySelector('[data-age-note]');
    if (!n) { return; }
    var a = /^\d{1,3}$/.test(v.age || '') && ((v.age || '').length >= 2 || ageCommitted) ? +v.age : null;
    n.hidden = a === null || (a > 17 && a <= 120);
    // 2.2 (ревю 08.10): вік понад 120 — теж підказка, інакше форма мовчки «стоїть».
    n.textContent = a === null ? '' : a > 120 ? 'Перевірте вік.' : a < 17 ? 'Центр проводить обстеження з 18 років.' : a === 17 ? 'Для 17 років можливість обстеження уточнить оператор.' : '';
    n.className = a !== null && (a < 17 || a > 120) ? 'agestop' : 'apnote';
  }
  function setChips(c, value) {
    if (!c) { return; }
    c.setAttribute('data-value', value || '');
    c.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-val') === value); });
    if (c.getAttribute('data-chips') === 'zone_group') { renderZoneSub(c.closest('form'), value); }
    if (c.getAttribute('data-chips') === 'modality') { renderZoneGroups(c.closest('form'), value); }
    var fldEl = c.closest('.fld'); if (fldEl && value) { clearErr(fldEl); }
  }
  // Групи ділянок для обраної модальності (07.10): КТ і МРТ мають різні переліки з прайсу Олі. Обрана раніше група й ділянка
  // лишаються, якщо вони є і в новій модальності; інакше вибір знімається.
  function renderZoneGroups(form, mod) {
    var box = form.querySelector('[data-zone-box]');
    if (!box || box.getAttribute('data-for') === (mod || '')) { return; }
    var prevG = (form.querySelector('.chips[data-chips="zone_group"]') || { getAttribute: function () { return ''; } }).getAttribute('data-value') || '';
    var prevI = (form.querySelector('.chips[data-chips="zone_item"]') || { getAttribute: function () { return ''; } }).getAttribute('data-value') || '';
    box.setAttribute('data-for', mod || '');
    var groups = zoneGroups(mod);
    box.innerHTML = groups.length ? chips('zone_group', groups.map(function (g) { return g[0]; })) : '';
    var keep = groups.filter(function (g) { return g[0] === prevG; })[0];
    if (keep) {
      setChips(box.querySelector('.chips'), prevG);
      if (keep[1].some(function (it) { return it[0] === prevI; })) { setChips(form.querySelector('.chips[data-chips="zone_item"]'), prevI); }
    } else {
      renderZoneSub(form, '');
    }
  }
  function renderZoneSub(form, group) {
    var box = form.querySelector('[data-zone-sub]');
    var mod = (form.querySelector('.chips[data-chips="modality"]') || { getAttribute: function () { return ''; } }).getAttribute('data-value') || '';
    // Той самий метод і група — список уже на екрані, не перемальовуємо (інакше губиться обрана ділянка, 08.10).
    if (box.getAttribute('data-for') === mod + '|' + (group || '')) { return; }
    box.setAttribute('data-for', mod + '|' + (group || ''));
    var g = zoneGroups(mod).filter(function (x) { return x[0] === group; })[0];
    var items = g ? g[1].map(function (it) { return it[0]; }) : [];
    box.innerHTML = items.length ? '<div class="sl">Оберіть ділянку в групі <b>' + esc(group) + '</b></div>' + chips('zone_item', items) : '';
    box.hidden = !items.length;
  }
  function fillDraft(form, d) {
    if (d.modality) { setChips(form.querySelector('.chips[data-chips="modality"]'), d.modality); }
    if (d.zone_group) { setChips(form.querySelector('.chips[data-chips="zone_group"]'), d.zone_group); }
    Object.keys(d).forEach(function (k) {
      var c = form.querySelector('.chips[data-chips="' + k + '"]');
      if (c) { if (k !== 'zone_group' && k !== 'modality') { setChips(c, d[k]); } return; }
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
    if (!v.age) { e.age = 'Вкажіть вік'; } else if (+v.age > 120) { e.age = 'Перевірте вік'; } else if (+v.age < 17) { e.age = 'Центр проводить обстеження з 18 років.'; }
    if (!v.weight) { e.weight = 'Оберіть вагу'; }
    if (c.girth_q && !v.girth) { e.girth = 'Оберіть обхват'; }
    if (c.mri && c.knee && !v.knee) { e.knee = 'Оберіть обхват коліна'; }
    if (c.contrast && !v.gfr) { e.gfr = 'Оберіть варіант'; }
    if (c.referral && !v.referral) { e.referral = 'Є скерування чи немає?'; }
    if (!v.preferred_date) { e.preferred_date = 'Оберіть бажаний день'; }
    else if (v.preferred_date < dayISO(0) || v.preferred_date > dayISO(60)) { e.preferred_date = 'Оберіть день від сьогодні і в межах найближчих 60 днів'; }
    if (!partOfDay(v)) { e.preferred_part = 'Оберіть частину дня або вкажіть точну годину'; }
    if (!v.first_name) { e.first_name = 'Вкажіть ім’я'; }
    if (!v.last_name) { e.last_name = 'Вкажіть прізвище'; }
    if (!/^\+380 \d{2} \d{3} \d{2} \d{2}$/.test(v.phone)) { e.phone = 'Введіть повний номер'; }
    if (!v.consent) { e.consent = 'Без згоди заявку надіслати не можна'; }
    return e;
  }

  function renderForm() {
    if (formDone) { renderDone(); return; }
    body.innerHTML = formHtml();
    var form = body.querySelector('form');
    var dr = loadDraft();
    ageCommitted = !!dr.age; nameCommitted = !!(dr.first_name && dr.last_name); lastStep = 0;
    fillDraft(form, dr);
    applyVisibility(form);
    form.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-time]');
      if (tb) {
        var et = form.querySelector('input[name="exact_time"]');
        et.value = et.value === tb.getAttribute('data-time') ? '' : tb.getAttribute('data-time');
        applyVisibility(form);
        return;
      }
      var nb = e.target.closest('[data-next="tg"]');
      if (!nb) { return; }
      form.querySelector('input[name="tg_done"]').value = '1';
      applyVisibility(form);
    });
    // 08.10 (вказівка користувача): календар відкривається від натискання будь-де в полі дати, а не лише на значок.
    form.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || t.type !== 'date' || typeof t.showPicker !== 'function') { return; }
      try { t.showPicker(); } catch (er) {}
    });
    form.addEventListener('focusout', function (e) {
      var n = e.target && e.target.name;
      if (n === 'age' && e.target.value) { ageCommitted = true; applyVisibility(form); }
      if ((n === 'first_name' || n === 'last_name') && form.querySelector('[name=first_name]').value.trim() && form.querySelector('[name=last_name]').value.trim()) { nameCommitted = true; applyVisibility(form); }
    });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && /^(age|first_name|last_name)$/.test(e.target.name)) { e.preventDefault(); e.target.blur(); }
    });

    form.addEventListener('click', function (e) {
      var b = e.target.closest('.chips button');
      if (!b || b.disabled) { return; }
      var c = b.parentNode;
      var cur = c.getAttribute('data-value');
      var val = b.getAttribute('data-val');
      var nm = c.getAttribute('data-chips');
      // 2.16: повторне натискання на обрану групу ділянок не знімає вибір (люди тиснуть «щоб розгорнути»).
      setChips(c, c.classList.contains('seg') || nm === 'zone_group' ? val : (cur === val ? '' : val));
      // 2.15: змінився метод чи контраст — у блоці тумблерів можуть з'явитись нові рядки, тож «Далі» треба натиснути знову.
      if ((nm === 'modality' || nm === 'contrast') && cur !== val) { var tgd = form.querySelector('input[name="tg_done"]'); if (tgd) { tgd.value = ''; } }
      applyVisibility(form);
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.name === 'phone') { t.value = formatPhone(t.value); }
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
      // Бажаний час: день окремо в «дд.мм», частина дня або точна година окремо, плюс людський підпис на обидва поля.
      formPreferred = ddmm(v.preferred_date) + ', ' + partOfDay(v).toLowerCase();
      var payload = {
        session_id: 'fm-' + uid().slice(3), site: SITE, page: location.href,
        modality: v.modality, zone: zoneText(v), apparatus: apSent(form, v), contrast: v.contrast.toLowerCase(), exam_code: examCode(form, v),
        apparatus_op: apOp(form, v), exam_codes: examCodes(v),
        for_other: v.for_other, age: v.age, weight_band: v.weight, girth_band: v.girth, knee_band: v.knee,
        implants: v.implants, implants_docs: v.implants_docs, pacemaker: v.pacemaker, lens: v.lens, lens_recent: v.lens_recent,
        defibrillator: v.defibrillator, neurostimulator: v.neurostimulator, stents: v.stents, joint_prosthesis: v.joint_prosthesis, metal_fragments: v.metal_fragments,
        cannot_lie: v.cannot_lie, claustro: v.claustro, biopsy: v.biopsy, biopsy_recent: v.biopsy_recent, primovist: v.primovist,
        gfr_status: v.gfr, anemia: v.anemia, lactation: v.lactation, pregnancy: v.pregnancy,
        referral: v.referral.toLowerCase(),
        preferred_date: ddmm(v.preferred_date), preferred_part: partOfDay(v), preferred_time: formPreferred,
        name: v.first_name + ' ' + v.last_name, first_name: v.first_name, last_name: v.last_name,
        phone: v.phone, consent: v.consent
      };
      var ep = resetEpoch;
      fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (x) {
          if (ep !== resetEpoch) { return; }
          formBusy = false;
          if (x.status === 200 && x.d && x.d.ok) { formDone = x.d; try { sessionStorage.removeItem(FORM_KEY); } catch (e2) {} render(); return; }
          var msg = (x.d && x.d.errors && x.d.errors.length) ? x.d.errors.join('. ') : 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть у чат.';
          setErr(form, 'consent', msg); btn.disabled = false; btn.textContent = 'Надіслати заявку';
        })
        .catch(function () {
          if (ep !== resetEpoch) { return; }
          formBusy = false;
          setErr(form, 'consent', 'Не вдалося надіслати заявку. Перевірте інтернет і спробуйте ще раз.');
          btn.disabled = false; btn.textContent = 'Надіслати заявку';
        });
    });
  }

  // Апарат, з яким іде заявка, і код позиції прайсу Олі (КТ — код ділянки; МРТ — код на обраному апараті, без апарата — порожньо).
  function apSent(form, v) { var c = conds(v); if (!c.mri) { return ''; } var r = aparatRule(v, c); return r && r.op ? '' : (v.apparatus || ''); }
  function apOp(form, v) { var r = aparatRule(v, conds(v)); return !!(r && r.op); }
  function examCode(form, v) {
    var zi = zoneInfo(v);
    if (!zi) { return ''; }
    if (v.modality === 'КТ') { return zi[1] || ''; }
    var ap = apSent(form, v);
    return ap === '1,5 Тесла' ? (zi[1] || '') : ap === '3 Тесла' ? (zi[2] || '') : '';
  }
  function examCodes(v) { var zi = zoneInfo(v); return zi ? zi.slice(1).filter(Boolean).join(',') : ''; }
  function renderDone() {
    var d = formDone;
    var h = '<div class="done"><div class="ok"><b>Дякуємо' + (d.name ? ', ' + esc(d.name) : '') + '! Заявку передано реєстратурі.</b>' + esc(d.closing || '') + '</div>';
    // Чіткого запису немає: показуємо той бажаний час, з яким пішла заявка. 08.10: двигун часу відхилив день чи годину
    // (chas_ok false, chas_reason — його слова) — пацієнт бачить причину, а не «оператор підтвердить».
    var pref = d.preferred_time || formPreferred;
    if (pref && d.chas_ok === false) { h += '<div class="booked">Бажаний час: <b>' + esc(pref) + '</b>' + (d.chas_reason ? ' — ' + esc(d.chas_reason) : '') + ' Оператор запропонує інший час.</div>'; }
    else if (pref) { h += '<div class="booked">Бажаний час: <b>' + esc(pref) + '</b>.</div>'; }
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
    if (state.open && !isPhone()) { setOpen(true); } else if (state.open) { state.open = false; save(); }
  }
  if (document.body) { mount(); } else { document.addEventListener('DOMContentLoaded', mount); }
})();
