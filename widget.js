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
  var ZONES = ['головного мозку', 'орбіт', 'придаткових пазух носа', 'гіпофіза', 'шийного відділу хребта', 'грудного відділу хребта', 'поперекового відділу хребта', 'крижів', 'плечового суглоба', 'ліктьового суглоба', 'кисті', 'кульшових суглобів', 'колінного суглоба', 'гомілково-ступневого суглоба', 'стопи', 'мяких тканин шиї', 'органів грудної клітки', 'грудних залоз', 'черевної порожнини', 'печінки', 'підшлункової залози', 'нирок', 'малого таза', 'простати', 'матки й придатків', 'судин головного мозку', 'судин шиї'];

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
    + '.f{display:flex;flex-direction:column;gap:10px;font-size:14px}'
    + '.f .note103{background:#fff8e6;border:1px solid #f3dfae;color:#6b4e00;border-radius:10px;padding:8px 10px;font-size:12.5px}'
    + '.f h4{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#5b6675;margin-top:6px}'
    + '.f label.l{display:block;font-size:13px;color:#3d4756;margin-bottom:3px}'
    + '.f input[type=text],.f input[type=number],.f input[type=tel]{width:100%;border:1px solid #d5dae2;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;background:#fff;outline:none}'
    + '.f input:focus{border-color:' + COLOR + '}'
    + '.f .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
    + '.seg{display:flex;gap:6px;flex-wrap:wrap}'
    + '.seg button{flex:1;min-width:70px;border:1.5px solid #d5dae2;background:#fff;border-radius:10px;padding:8px 6px;font:inherit;font-size:13.5px;cursor:pointer;color:#1c2430}'
    + '.seg button.on{border-color:' + COLOR + ';background:' + COLOR + ';color:#fff}'
    + '.chk{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;cursor:pointer;line-height:1.35}'
    + '.chk input{margin-top:3px;flex:none;width:16px;height:16px;accent-color:' + COLOR + '}'
    + '.sub{margin:-4px 0 4px 10px;padding-left:10px;border-left:2px solid #e6e9ee;display:flex;flex-direction:column;gap:8px}'
    + '.f .hint{font-size:12px;color:#7a8594}'
    + '.f .errs{background:#fff3f3;color:#9b1c1c;border-radius:10px;padding:8px 10px;font-size:13px;white-space:pre-wrap}'
    + '.f .submit{border:0;border-radius:12px;background:' + COLOR + ';color:#fff;font:inherit;font-weight:600;font-size:15px;padding:12px;cursor:pointer;margin-top:4px}'
    + '.f .submit:disabled{opacity:.6;cursor:default}'
    + '.done{display:flex;flex-direction:column;gap:10px;font-size:14px}'
    + '.done .ok{background:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '.done .ok b{display:block;font-size:16px;margin-bottom:6px;color:' + COLOR + '}'
    + '.done .esc{background:#fff8e6;border:1px solid #f3dfae;color:#6b4e00;border-radius:10px;padding:8px 10px}'
    + '.done p{background:#fff;border-radius:12px;padding:10px 13px;box-shadow:0 1px 2px rgba(0,0,0,.06)}'
    + '@media (max-width:480px){.am{right:0;bottom:0}.launch{margin:0 16px 16px 0}.am-panel{width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}}';

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

  function segHtml(name, opts) {
    return '<div class="seg" data-seg="' + name + '">' + opts.map(function (o) { return '<button type="button" data-val="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function inp(name, label, type, attrs) {
    return '<div><label class="l" for="f_' + name + '">' + label + '</label><input id="f_' + name + '" name="' + name + '" type="' + (type || 'text') + '" ' + (attrs || '') + '></div>';
  }
  function chk(name, label, ifs) {
    return '<label class="chk"' + (ifs ? ' data-if="' + ifs + '"' : '') + '><input type="checkbox" name="' + name + '"><span>' + label + '</span></label>';
  }

  function formHtml() {
    return '<form class="f" novalidate>'
      + '<div class="note103">Якщо це невідкладний стан (ознаки інсульту, тяжка травма, гострий біль у животі, кровотеча), не заповнюйте форму, а телефонуйте 103.</div>'
      + '<h4>Обстеження</h4>'
      + segHtml('modality', ['КТ', 'МРТ', 'Не знаю'])
      + '<div><label class="l" for="f_zone">Що обстежуємо</label><input id="f_zone" name="zone" type="text" list="am-zones" placeholder="наприклад, поперекового відділу хребта" autocomplete="off"><datalist id="am-zones">' + ZONES.map(function (z) { return '<option value="' + esc(z) + '">'; }).join('') + '</datalist></div>'
      + '<div data-if="mri"><label class="l">Апарат МРТ</label>' + segHtml('apparatus', ['1,5 Тесла', '3 Тесла', 'Не знаю']) + '</div>'
      + '<div><label class="l">Контраст</label>' + segHtml('contrast', ['З контрастом', 'Без контрасту', 'Не знаю']) + '</div>'
      + '<h4>Пацієнт</h4>'
      + chk('for_other', 'Записую іншу людину')
      + inp('name', 'Ім\'я пацієнта', 'text', 'autocomplete="name" maxlength="60"')
      + '<div class="two">' + inp('age', 'Повних років', 'number', 'min="0" max="120" inputmode="numeric"') + inp('weight', 'Вага, кг', 'number', 'min="2" max="350" inputmode="numeric"') + '</div>'
      + '<div data-if="mri">' + inp('girth', 'Обхват тіла в найгрубшому місці при опущених руках, см', 'number', 'min="30" max="250" inputmode="numeric"') + '<div class="hint">Апарат 1,5 Тесла до 140 см, 3 Тесла до 160 см</div></div>'
      + '<div data-if="mri knee">' + inp('knee_girth', 'Обхват у ділянці коліна, см', 'number', 'min="20" max="120" inputmode="numeric"') + '<div class="hint">1,5 Тесла до 59 см, 3 Тесла до 45 см</div></div>'
      + '<h4 data-if="mri contrast ct">Відмітьте, що стосується пацієнта</h4>'
      + chk('implants', 'Металеві імпланти, штучні суглоби, стенти, пластини або осколки', 'mri')
      + '<div class="sub" data-if="mri implants">' + inp('implants_text', 'Які саме', 'text', 'maxlength="200"') + chk('implants_docs', 'Є паспорт, сертифікат або довідка лікаря на них') + '</div>'
      + chk('pacemaker', 'Кардіостимулятор або дефібрилятор', 'mri')
      + chk('lens', 'Імплантований кришталик ока', 'mri')
      + '<div class="sub" data-if="mri lens">' + inp('lens_months', 'Місяців після операції', 'number', 'min="0" max="600" inputmode="numeric"') + '</div>'
      + chk('cannot_lie', 'Не зможу лежати нерухомо 20-40 хвилин', 'mri')
      + chk('claustro', 'Страх закритого простору', 'mri')
      + chk('biopsy', 'Проводилась біопсія простати', 'mri prostate')
      + '<div class="sub" data-if="mri prostate biopsy">' + inp('biopsy_weeks', 'Тижнів після біопсії', 'number', 'min="0" max="520" inputmode="numeric"') + '</div>'
      + chk('primovist', 'Лікар призначив контраст Примовіст', 'mri liver')
      + '<div data-if="contrast"><label class="l">Аналіз на креатинін і ШКФ за останні 10-14 днів</label><div class="two">' + inp('gfr', 'ШКФ, мл/хв', 'number', 'min="1" max="300" inputmode="decimal"') + inp('gfr_days', 'Здано днів тому', 'number', 'min="0" max="365" inputmode="numeric"') + '</div>' + chk('gfr_none', 'Аналізів немає') + '</div>'
      + chk('anemia', 'Анемія', 'ct contrast')
      + '<div class="sub" data-if="ct contrast anemia">' + inp('hemoglobin', 'Гемоглобін', 'number', 'min="20" max="250" inputmode="numeric"') + '</div>'
      + chk('lactation', 'Годую груддю', 'contrast')
      + chk('pregnancy', 'Вагітність', 'ct')
      + '<div data-if="referral"><h4>Скерування від лікаря</h4>' + segHtml('referral', ['Є', 'Немає']) + '<div class="sub" data-if="referral has_ref" style="margin-top:8px">' + inp('referral_text', 'Від якого лікаря і який діагноз або зона', 'text', 'maxlength="200"') + '</div></div>'
      + '<h4>Запис</h4>'
      + inp('preferred_time', 'Бажаний день і час', 'text', 'placeholder="наприклад, вівторок після обіду" maxlength="120"')
      + inp('phone', 'Телефон', 'tel', 'placeholder="+380" autocomplete="tel" inputmode="tel" maxlength="30"')
      + '<label class="chk"><input type="checkbox" name="consent"><span>Погоджуюсь на обробку персональних даних медичним центром для запису на обстеження</span></label>'
      + '<div class="errs" hidden></div>'
      + '<button type="submit" class="submit">Надіслати заявку</button>'
      + '</form>';
  }

  var SEG_MAP = { 'КТ': 'КТ', 'МРТ': 'МРТ', 'Не знаю': 'не знаю', '1,5 Тесла': '1,5 Тесла', '3 Тесла': '3 Тесла', 'З контрастом': 'з контрастом', 'Без контрасту': 'без контрасту', 'Є': 'є', 'Немає': 'немає' };

  function vals(form) {
    var v = {};
    form.querySelectorAll('.seg').forEach(function (s) { v[s.getAttribute('data-seg')] = s.getAttribute('data-value') || ''; });
    form.querySelectorAll('input[name]').forEach(function (i) { v[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
    return v;
  }
  function conds(v) {
    var z = (v.zone || '').toLowerCase();
    var mri = v.modality === 'МРТ', ct = v.modality === 'КТ', contrast = v.contrast === 'з контрастом';
    return {
      mri: mri, ct: ct, contrast: contrast,
      knee: /колін/.test(z), prostate: /простат/.test(z), liver: /печінк/.test(z),
      implants: !!v.implants, lens: !!v.lens, biopsy: !!v.biopsy, anemia: !!v.anemia,
      referral: ct || (mri && (!!v.pregnancy || (!!v.lactation && contrast))),
      has_ref: v.referral === 'є'
    };
  }
  function applyVisibility(form) {
    var v = vals(form), c = conds(v);
    form.querySelectorAll('[data-if]').forEach(function (el) {
      var keys = el.getAttribute('data-if').split(/\s+/);
      var show;
      if (el.tagName === 'H4') { show = keys.some(function (k) { return c[k]; }); }   // заголовок блоку: хоч одна умова
      else { show = keys.every(function (k) { return c[k]; }); }
      el.hidden = !show;
    });
    saveDraft(v);
  }
  function fillDraft(form, d) {
    Object.keys(d || {}).forEach(function (k) {
      var seg = form.querySelector('.seg[data-seg="' + k + '"]');
      if (seg) { setSeg(seg, d[k]); return; }
      var i = form.querySelector('input[name="' + k + '"]');
      if (!i) { return; }
      if (i.type === 'checkbox') { i.checked = !!d[k]; } else { i.value = d[k] == null ? '' : d[k]; }
    });
  }
  function setSeg(seg, value) {
    seg.setAttribute('data-value', value || '');
    seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', SEG_MAP[b.getAttribute('data-val')] === value); });
  }

  function clientErrors(v) {
    var e = [];
    if (!v.modality) { e.push('Оберіть КТ або МРТ'); }
    if (!v.zone) { e.push('Вкажіть, що обстежуємо'); }
    if (!v.contrast) { e.push('Оберіть, з контрастом чи без'); }
    if (!v.name) { e.push('Вкажіть ім\'я пацієнта'); }
    if (v.age === '' || isNaN(+v.age)) { e.push('Вкажіть вік'); }
    if (v.weight === '' || isNaN(+v.weight)) { e.push('Вкажіть вагу'); }
    if (!v.preferred_time) { e.push('Вкажіть бажаний день і час'); }
    var p = (v.phone || '').replace(/[^\d+]/g, '');
    if (!/^(\+?380|0)\d{9}$/.test(p)) { e.push('Телефон у форматі +380XXXXXXXXX'); }
    if (!v.consent) { e.push('Потрібна згода на обробку даних'); }
    if (v.age !== '' && +v.age < 18 && v.contrast === 'з контрастом') { e.push('Дітям до 18 років обстеження з контрастною речовиною, і КТ, і МРТ, ми не проводимо. Оберіть «Без контрасту» або «Не знаю», і лікар вирішить'); }
    return e;
  }

  function renderForm() {
    if (formDone) { renderDone(); return; }
    body.innerHTML = formHtml();
    var form = body.querySelector('form');
    fillDraft(form, loadDraft());
    applyVisibility(form);

    form.addEventListener('click', function (e) {
      var b = e.target.closest('.seg button');
      if (!b) { return; }
      setSeg(b.parentNode, SEG_MAP[b.getAttribute('data-val')]);
      applyVisibility(form);
    });
    form.addEventListener('input', function () { applyVisibility(form); });
    form.addEventListener('change', function () { applyVisibility(form); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formBusy) { return; }
      var v = vals(form);
      var errs = clientErrors(v);
      var box = form.querySelector('.errs');
      if (errs.length) { box.hidden = false; box.textContent = errs.join('\n'); box.scrollIntoView({ block: 'nearest' }); return; }
      box.hidden = true;
      formBusy = true;
      var btn = form.querySelector('.submit'); btn.disabled = true; btn.textContent = 'Надсилаю...';
      v.session_id = 'fm-' + uid().slice(3); v.site = SITE; v.page = location.href;
      fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (x) {
          formBusy = false;
          if (x.status === 200 && x.d && x.d.ok) { formDone = x.d; try { sessionStorage.removeItem(FORM_KEY); } catch (e2) {} render(); return; }
          var msg = (x.d && x.d.errors && x.d.errors.length) ? x.d.errors.join('\n') : 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть у чат.';
          box.hidden = false; box.textContent = msg; btn.disabled = false; btn.textContent = 'Надіслати заявку';
        })
        .catch(function () {
          formBusy = false;
          box.hidden = false; box.textContent = 'Не вдалося надіслати заявку. Перевірте інтернет і спробуйте ще раз.';
          btn.disabled = false; btn.textContent = 'Надіслати заявку';
        });
    });
  }

  function renderDone() {
    var d = formDone;
    var h = '<div class="done"><div class="ok"><b>Дякуємо' + (d.name ? ', ' + esc(d.name) : '') + '. Заявку передано реєстратурі.</b>' + esc(d.closing || '') + '</div>';
    if (d.escalation) { h += '<div class="esc">З цим питанням має розібратися наш лікар. Радіолог зателефонує вам.</div>'; }
    (d.notes || []).forEach(function (n) { h += '<p>' + esc(n) + '</p>'; });
    if ((d.preparation || []).length) { h += '<h4 style="font-size:13px;color:#5b6675;text-transform:uppercase;letter-spacing:.04em">Підготовка</h4>'; }
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
