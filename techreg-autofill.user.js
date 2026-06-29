// ==UserScript==
// @name         Techreg Autofill Bridge
// @namespace    applications-portal
// @version      0.4.4
// @description  Autofill techreg.gov.kz form from applications portal payload
// @match        https://techreg.gov.kz/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const DEFAULT_API = "http://localhost:5000";
  const IGNORED_TYPES = new Set(["label", "custom", "processlist", "appendable_table", "entity", "counter", "file"]);
  const SKIP_FIELD_IDS = new Set([
    "textbox_uveos",
    "textbox_fio_user",
    "textbox_firstname_user",
    "textbox_lastname_user",
    "textbox_patronymic_user",
    "textbox_iin",
  ]);
  const SYNERGY_SAVE_URL = "/Synergy/rest/api/asforms/form/multipartdata";
  const FORM_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const formContext = {
    form: localStorage.getItem("techreg.autofill.form") || "",
    uuid: localStorage.getItem("techreg.autofill.uuid") || "",
    lastData: null,
    lastDataUuid: "",
  };

  let capturedAuthHeader = localStorage.getItem("techreg.autofill.auth") || "";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const esc = (value) =>
    window.CSS && window.CSS.escape ? window.CSS.escape(value) : value.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");

  const log = (message) => {
    const area = document.getElementById("techreg-autofill-log");
    if (!area) return;
    area.value += `${new Date().toLocaleTimeString()} ${message}\n`;
    area.scrollTop = area.scrollHeight;
  };

  const isValidFormId = (id) => FORM_UUID_RE.test(String(id || "").trim());

  const syncPanelFields = () => {
    const formInput = document.getElementById("techreg-autofill-form-id");
    const recordInput = document.getElementById("techreg-autofill-record-id");
    if (formInput && formContext.form && isValidFormId(formContext.form)) {
      formInput.value = formContext.form;
    }
    if (recordInput && formContext.uuid) {
      recordInput.value = formContext.uuid;
    }
  };

  const persistFormContext = () => {
    if (formContext.form) localStorage.setItem("techreg.autofill.form", formContext.form);
    if (formContext.uuid) localStorage.setItem("techreg.autofill.uuid", formContext.uuid);
    syncPanelFields();
  };

  const validateTechregContext = (ctx) => {
    if (!ctx.form || !ctx.uuid) {
      return "нет Form ID или Record ID — см. DevTools → Network → multipartdata";
    }
    if (!isValidFormId(ctx.form)) {
      return `Form ID неверный: «${ctx.form}». Нужен полный UUID (0a89f184-1655-4d92-89ca-dca5d81fcb96), не Application ID!`;
    }
    if (!/^\d+$/.test(String(ctx.uuid))) {
      return `Record ID должен быть числом (uuid из multipartdata), сейчас: «${ctx.uuid}»`;
    }
    return null;
  };

  const scrapeFormContextFromPage = () => {
    const html = document.documentElement?.innerHTML || "";
    let form = null;
    let uuid = null;

    const formMatch = html.match(
      /form["'\s:=]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    if (formMatch) form = formMatch[1];

    const uuidMatch =
      html.match(/[?&]uuid=(\d+)/)?.[1] ||
      html.match(/"uuid"\s*:\s*"?(\d+)"?/)?.[1] ||
      html.match(/uuid["'\s:=]+(\d{5,})/i)?.[1];
    if (uuidMatch) uuid = uuidMatch;

    if (form && isValidFormId(form)) formContext.form = form;
    if (uuid) {
      if (formContext.lastDataUuid && uuid !== formContext.lastDataUuid) {
        formContext.lastData = null;
      }
      formContext.uuid = uuid;
    }
    if (form || uuid) persistFormContext();
    return { form: formContext.form, uuid: formContext.uuid };
  };

  const parseDataArray = (raw) => {
    if (!raw) return null;
    const text = String(raw).trim();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.data)) return parsed.data;
    } catch {
      // Synergy sometimes sends `"data" : [...]`
    }

    const match = text.match(/"data"\s*:\s*(\[[\s\S]*\])\s*$/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  };

  const captureFromUrlEncoded = (body) => {
    if (!body || typeof body !== "string") return;
    const params = new URLSearchParams(body);
    const form = params.get("form");
    const uuid = params.get("uuid");
    const data = parseDataArray(params.get("data"));
    if (form) formContext.form = form;
    if (uuid) {
      if (formContext.lastDataUuid && uuid !== formContext.lastDataUuid) {
        formContext.lastData = null;
      }
      formContext.uuid = uuid;
    }
    if (data?.length) {
      formContext.lastData = data;
      if (uuid) formContext.lastDataUuid = uuid;
      refreshFieldLabelMap();
    }
    if (form || uuid || data) persistFormContext();
  };

  const captureFromUrl = (url) => {
    if (!url || !String(url).includes("multipartdata")) return;
    try {
      const parsed = new URL(url, location.origin);
      const form = parsed.searchParams.get("form");
      const uuid = parsed.searchParams.get("uuid");
      if (form) formContext.form = form;
      if (uuid) {
      if (formContext.lastDataUuid && uuid !== formContext.lastDataUuid) {
        formContext.lastData = null;
      }
      formContext.uuid = uuid;
    }
      if (form || uuid) persistFormContext();
    } catch {
      // ignore
    }
  };

  const hookNetwork = () => {
    const originalFetch = window.fetch;
    window.fetch = async function patchedFetch(input, init) {
      const url = typeof input === "string" ? input : input?.url;
      readHeadersAuth(init?.headers);
      captureFromUrl(url);
      if (init?.body) captureFromUrlEncoded(String(init.body));

      const response = await originalFetch.apply(this, arguments);
      if (url && String(url).includes("multipartdata")) {
        response
          .clone()
          .text()
          .then((text) => {
            const data = parseDataArray(text);
            if (data?.length) {
              formContext.lastData = data;
              refreshFieldLabelMap();
            }
          })
          .catch(() => {});
      }
      return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name, value) {
      if (String(name).toLowerCase() === "authorization") rememberAuthHeader(String(value));
      return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__techregUrl = url;
      captureFromUrl(url);
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function patchedSend(body) {
      captureFromUrlEncoded(body ? String(body) : "");
      this.addEventListener("load", function onLoad() {
        if (this.__techregUrl && String(this.__techregUrl).includes("multipartdata")) {
          const data = parseDataArray(this.responseText);
          if (data?.length) {
            formContext.lastData = data;
            refreshFieldLabelMap();
          }
        }
      });
      return originalSend.apply(this, arguments);
    };
  };

  hookNetwork();

  const setNativeValue = (element, value) => {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const walkNodes = function* (root) {
    if (!root) return;
    yield root;
    const children = root.children ? Array.from(root.children) : [];
    for (const child of children) {
      yield* walkNodes(child);
      if (child.shadowRoot) yield* walkNodes(child.shadowRoot);
    }
  };

  const getSearchRoots = () => {
    const roots = [document];
    for (const frame of document.querySelectorAll("iframe")) {
      try {
        if (frame.contentDocument) roots.push(frame.contentDocument);
      } catch {
        // cross-origin iframe
      }
    }
    return roots;
  };

  const collectAsForms = () => {
    const forms = [];
    for (const root of getSearchRoots()) {
      for (const node of root.querySelectorAll?.("form") || []) {
        try {
          const asForm = typeof node.asForm === "function" ? node.asForm() : null;
          if (asForm) forms.push(asForm);
        } catch {
          // ignore
        }
      }
    }
    return forms;
  };

  const findFieldElement = (id) => {
    const input = findInputForField(id);
    if (input) return input;

    const selectors = [
      `#${esc(id)}`,
      `[name="${esc(id)}"]`,
      `[data-id="${esc(id)}"]`,
      `[data-field-id="${esc(id)}"]`,
      `[data-field="${esc(id)}"]`,
      `[id$="${esc(id)}"]`,
      `[id*="${esc(id)}"]`,
      `[name*="${esc(id)}"]`,
    ];

    for (const root of getSearchRoots()) {
      const byId = root.getElementById?.(id);
      if (byId) return byId;

      for (const selector of selectors) {
        const found = root.querySelector?.(selector);
        if (found) return found;
      }

      for (const node of walkNodes(root.body || root.documentElement)) {
        if (!(node instanceof Element)) continue;
        if (node.id === id || node.getAttribute("name") === id) return node;
        if (node.id?.includes(id) || node.getAttribute("name")?.includes(id)) return node;
      }
    }
    return null;
  };

  const INPUT_SELECTOR =
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]';

  const isInputInteractable = (inp) => {
    if (!inp || inp.disabled) return false;
    if (inp.type === "hidden") return false;
    try {
      const style = window.getComputedStyle(inp);
      if (style.display === "none" || style.visibility === "hidden") return false;
    } catch {
      return false;
    }
    if (inp.offsetParent !== null) return true;
    const rect = inp.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  };

  const stripLabelNoise = (text) =>
    String(text || "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeLabel = (text) =>
    stripLabelNoise(text)
      .toLowerCase()
      .replace(/[*:：]/g, "");

  const fillSession = {
    usedInputs: new Set(),
    rowIndex: null,
    currentTab: "",
  };

  const resetFillSession = () => {
    fillSession.usedInputs = new Set();
    fillSession.rowIndex = null;
    fillSession.currentTab = "";
  };

  const resetTabFillSession = (tabKey) => {
    fillSession.usedInputs = new Set();
    fillSession.rowIndex = null;
    fillSession.currentTab = tabKey;
  };

  const isInputAvailable = (input) => input && !fillSession.usedInputs.has(input);

  const markInputUsed = (input) => {
    if (input) fillSession.usedInputs.add(input);
  };

  const FIELD_INPUT_PREFS = {
    reglink_mark: { preferInputIndex: 0, manualInputIndex: 1 },
    textbox_name_mark: { preferInputIndex: 1, preferLast: true },
    listbox_category: { preferInputIndex: 0, manualInputIndex: 1 },
    listbox_ecological_class: { preferInputIndex: 0 },
    listbox_name_fuel: { preferInputIndex: 0 },
  };

  const buildFormRowIndex = () => {
    const index = [];

    const addRow = (label, container) => {
      if (!label || label.length > 350) return;
      if (container.closest?.("#techreg-autofill-panel")) return;

      const inputs = [...container.querySelectorAll(INPUT_SELECTOR)].filter(isInputInteractable);
      if (!inputs.length) return;

      const labelNorm = normalizeLabel(label);
      if (labelNorm.length < 2) return;

      index.push({
        label: label.trim(),
        labelNorm,
        inputs,
        input: inputs[0],
      });
    };

    const pickLabelFromCells = (cells) => {
      for (const cell of cells) {
        const text = cell.textContent.trim();
        if (!text || text.length > 250) continue;
        const cellInputs = cell.querySelectorAll(INPUT_SELECTOR);
        if (cellInputs.length === 0) return text;
      }
      return cells[0].textContent.trim();
    };

    for (const root of getSearchRoots()) {
      for (const tr of root.querySelectorAll("tr")) {
        const cells = [...tr.querySelectorAll(":scope > td, :scope > th")];
        if (cells.length < 2) continue;
        addRow(pickLabelFromCells(cells), tr);
      }

      for (const block of root.querySelectorAll('[class*="field"], [class*="control"]')) {
        if (block.closest?.("#techreg-autofill-panel")) continue;
        const labelEl = block.querySelector("label, .label, [class*='label'], th");
        const label = labelEl?.textContent?.trim() || pickLabelFromCells([block]);
        if (label && label.length < 250) addRow(label, block);
      }
    }

    return index;
  };

  const getFormRowIndex = () => {
    if (!fillSession.rowIndex) fillSession.rowIndex = buildFormRowIndex();
    return fillSession.rowIndex;
  };

  const scoreLabelMatch = (labelNorm, needle) => {
    if (!labelNorm || !needle) return 0;
    if (labelNorm === needle) return 100;

    if (labelNorm.includes(needle) || needle.includes(labelNorm)) {
      const minLen = Math.min(labelNorm.length, needle.length);
      const maxLen = Math.max(labelNorm.length, needle.length);
      if (minLen >= 3 && minLen / maxLen >= 0.2) return 88;
    }

    const needlePlain = normalizeLabel(stripLabelNoise(needle));
    if (needlePlain !== needle && (labelNorm.includes(needlePlain) || needlePlain.includes(labelNorm))) {
      return 86;
    }

    if (needle.length <= 24) {
      const word = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|\\s|/)${word}($|\\s|/)`, "i");
      if (re.test(labelNorm)) return 92;
      if (labelNorm.startsWith(needle)) return 88;
      const token = needle.split(/\s+/).find((t) => t.length >= 4);
      if (token && labelNorm.includes(token)) return 82;
    }

    if (labelNorm.startsWith(needle)) return 90;
    if (needle.startsWith(labelNorm) && labelNorm.length >= 8) return 85;

    const tokens = (s) => s.split(/\s+/).filter((t) => t.length >= 3);
    const hits = tokens(needle).filter((t) => tokens(labelNorm).some((l) => l.includes(t) || t.includes(l)));
    if (hits.length >= 2) return 84;
    if (hits.length === 1) {
      const weak = new Set(["номер", "адрес", "тип", "марка", "наименование", "класс", "мощность", "масса"]);
      if (weak.has(hits[0])) return 0;
      if (tokens(needle).length <= 4) return 78;
    }

    return 0;
  };

  const FIELD_ROW_REJECT = {
    textbox_id_number: [/номер оси/i, /\bось\b/i, /оси/i, /колес/i, /бagazh/i, /багаж/i, /мест для/i],
    textbox_address: [/фактическ/i, /изготовит/i, /сбороч/i, /транспорт/i],
    textbox_address_fact: [/место нахожд/i, /юридическ/i, /изготовит/i, /сбороч/i],
    textbox_address_manuf: [/заявител/i, /фактическ/i, /сбороч/i, /место нахожд/i],
    textbox_address_assembly_plant: [/заявител/i, /изготовит/i, /фактическ/i],
    textbox_legal_address: [/заявител/i, /сбороч/i, /фактическ/i],
    "textarea-juniae_copy1": [/сбороч/i, /заявител/i],
    "textarea-juniae_copy3": [/заявител/i, /изготовит/i],
    reglink_manuf_ts: [/иностран/i, /сбороч/i],
    reglink_manuf_ts_inostr: [/сбороч/i],
    reglink_assembly_plant_inostr: [/изготовит/i, /заявител/i],
  };

  const FIELD_ROW_REQUIRE = {
    textbox_id_number: [/vin|идентификацион/i],
    textbox_address: [/место нахожд|юридическ/i],
    textbox_address_fact: [/фактическ/i],
    "textarea-juniae_copy3": [/сбороч/i],
    textbox_address_assembly_plant: [/сбороч/i],
    reglink_assembly_plant_inostr: [/сбороч/i],
  };

  const rowRejectedForField = (fieldId, row) => {
    const patterns = FIELD_ROW_REJECT[fieldId];
    if (!patterns?.length) return false;
    return patterns.some((re) => re.test(row.labelNorm) || re.test(row.label));
  };

  const rowRequiredForField = (fieldId, row) => {
    const patterns = FIELD_ROW_REQUIRE[fieldId];
    if (!patterns?.length) return true;
    return patterns.some((re) => re.test(row.labelNorm) || re.test(row.label));
  };

  const FIELD_LABEL_FALLBACKS = {
    textbox_address: "место нахождения",
    textbox_address_fact: "Фактический адрес",
    textbox_email: "E-mail",
    textbox_phone: "Телефон",
    textbox_legal_address: "Юридический адрес",
    "textarea-juniae_copy1": "Наименование изготовителя",
    textbox_address_manuf: "Адрес изготовителя",
    reglink_manuf_ts: "Изготовитель транспортного средства",
    reglink_manuf_ts_inostr: "иностранный изготовитель",
    "textarea-juniae_copy3": "сборочный завод",
    textbox_address_assembly_plant: "Адрес сборочного завода",
    reglink_assembly_plant_inostr: "иностранный сборочный",
    reglink_mark: "Марка",
    textbox_name_mark: "Марка",
    textbox_id_number: "VIN",
    textbox_type_identifier: "Идентификатор типа",
    textarea_commercial_name: "Коммерческое наименование",
    textbox_year: "Год выпуска",
    listbox_category: "Категория",
    listbox_ecological_class: "Экологический класс",
    textbox_length: "Длина",
    textbox_width: "Ширина",
    textbox_height: "Высота",
    textbox_wheelbases: "Колесная база",
    textbox_track_front_rear_wheels: "Колея",
    textbox_number_of_seats: "Количество мест",
    textbox_body_type: "Тип кузова",
    textbox_engine_brand: "Марка двигателя",
    numericinput_number_of_engine_cylinders: "Число цилиндров",
    numericinput_engine_cylinder_displacement: "Рабочий объем",
    numericinput_engine_compression_ratio: "Степень сжатия",
    numericinput_maximum_power: "Максимальная мощность",
    listbox_name_fuel: "Топливо",
    textarea_exhaust: "Система выпуска",
    textbox_cp_type: "Коробка передач",
    textbox_mark_steering: "Рулевое управление",
    textbox_size_tires: "Шины",
    listbox_wheel_formula: "Колесная формула",
    textbox_driving_wheels: "Ведущие колеса",
    textbox_min: "Снаряженная масса",
    textbox_min_2: "Технически допустимая",
  };

  const getMatchingLabelsForField = (fieldId) => {
    const labels = [];
    const add = (text) => {
      const clean = String(text || "").trim();
      if (!clean) return;
      const norm = normalizeLabel(clean);
      if (!labels.some((item) => normalizeLabel(item) === norm)) labels.push(clean);
    };

    const cached = fieldLabelMap.get(fieldId);
    const fallback = FIELD_LABEL_FALLBACKS[fieldId];
    if (cached) {
      add(cached);
      add(stripLabelNoise(cached));
    }
    add(fallback);
    if (fieldId === "textbox_id_number") {
      add("Идентификационный номер");
      add("идентификационный номер VIN");
    }
    if (fieldId === "textbox_address") add("Адрес место нахождения");
    return labels;
  };

  const getLabelForField = (fieldId) => getMatchingLabelsForField(fieldId)[0] || "";

  const findRowForField = (fieldId) => {
    const labels = getMatchingLabelsForField(fieldId);
    if (!labels.length) return null;

    let bestRow = null;
    let bestScore = 0;

    for (const labelText of labels) {
      const needle = normalizeLabel(labelText);
      for (const row of getFormRowIndex()) {
        if (rowRejectedForField(fieldId, row)) continue;
        if (!rowRequiredForField(fieldId, row)) continue;
        const score = scoreLabelMatch(row.labelNorm, needle);
        if (score > bestScore) {
          bestScore = score;
          bestRow = row;
        }
      }
    }

    const minScore = fieldId === "textbox_id_number" ? 82 : 70;
    return bestScore >= minScore ? bestRow : null;
  };

  const pickInputFromRow = (fieldId, row) => {
    if (!row?.inputs?.length) return null;
    const prefs = FIELD_INPUT_PREFS[fieldId] || {};
    const available = row.inputs.filter(isInputAvailable);
    if (!available.length) return null;

    if (prefs.preferLast) {
      return available[available.length - 1];
    }
    if (typeof prefs.preferInputIndex === "number") {
      const preferred = row.inputs[prefs.preferInputIndex];
      if (preferred && isInputAvailable(preferred)) return preferred;
    }
    if (typeof prefs.manualInputIndex === "number" && fieldId.startsWith("textbox_")) {
      const manual = row.inputs[prefs.manualInputIndex];
      if (manual && isInputAvailable(manual)) return manual;
    }
    return available[0];
  };

  const findRowInputsForField = (fieldId) => {
    const row = findRowForField(fieldId);
    return row?.inputs || null;
  };

  const pickAvailableInput = (inputs, index) => {
    if (!inputs?.length || typeof index !== "number") return null;
    const candidate = inputs[index];
    return candidate && isInputAvailable(candidate) ? candidate : null;
  };

  const buildFieldLabelMap = (data) => {
    const map = new Map();
    const items = Array.isArray(data) ? data : [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item?.id) continue;

      if (item.type === "label" && item.label) {
        for (let j = i + 1; j < Math.min(i + 4, items.length); j += 1) {
          const next = items[j];
          if (!next?.id || IGNORED_TYPES.has(next.type)) continue;
          if (!map.has(next.id)) map.set(next.id, item.label);
          break;
        }
        if (item.id.startsWith("label")) {
          const guessed = item.id.replace(/^label[-_]?/, "");
          if (guessed !== item.id && !map.has(guessed)) map.set(guessed, item.label);
        }
      }

      if (item.id.endsWith("Label") && item.label) {
        const fieldId = item.id.slice(0, -5);
        if (!map.has(fieldId)) map.set(fieldId, item.label);
      }
    }
    return map;
  };

  let fieldLabelMap = buildFieldLabelMap(formContext.lastData);

  const refreshFieldLabelMap = () => {
    fieldLabelMap = buildFieldLabelMap(formContext.lastData);
    refreshTabFieldOrder();
  };

  const findInputByLabelText = (labelText, fieldId) => {
    const needle = normalizeLabel(labelText);
    if (!needle) return null;

    let bestRow = null;
    let bestScore = 0;

    for (const row of getFormRowIndex()) {
      if (fieldId && rowRejectedForField(fieldId, row)) continue;
      if (fieldId && !rowRequiredForField(fieldId, row)) continue;
      const score = scoreLabelMatch(row.labelNorm, needle);
      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    }

    if (!bestRow || bestScore < 70) return null;
    if (fieldId) return pickInputFromRow(fieldId, bestRow);
    const available = bestRow.inputs.filter(isInputAvailable);
    return available[0] || null;
  };

  const findInputByFieldIdViaLabel = (fieldId) => {
    const labelIds = [`label_${fieldId}`, `label-${fieldId}`, `${fieldId}Label`];
    for (const root of getSearchRoots()) {
      for (const lid of labelIds) {
        const labelEl =
          root.getElementById?.(lid) ||
          root.querySelector?.(`[id$="${esc(lid)}"]`) ||
          root.querySelector?.(`[id*="${esc(lid)}"]`);
        if (!labelEl) continue;

        const scopes = [
          labelEl.closest("tr"),
          labelEl.closest('[class*="field"]'),
          labelEl.closest('[class*="control"]'),
          labelEl.parentElement?.nextElementSibling,
          labelEl.parentElement,
        ].filter(Boolean);

        for (const scope of scopes) {
          const inputs = scope.querySelectorAll?.(INPUT_SELECTOR) || [];
          for (const input of inputs) {
            if (input && isInputAvailable(input) && isInputInteractable(input)) return input;
          }
        }
      }
    }
    return null;
  };

  const findInputForField = (id) => {
    const row = findRowForField(id);
    if (row) {
      const fromRow = pickInputFromRow(id, row);
      if (fromRow) return fromRow;
    }

    for (const root of getSearchRoots()) {
      const direct = root.querySelector?.(
        `input[name="${esc(id)}"], textarea[name="${esc(id)}"], select[name="${esc(id)}"], #${esc(id)}`
      );
      if (direct && isInputAvailable(direct) && isInputInteractable(direct)) {
        return direct;
      }

      for (const input of root.querySelectorAll(INPUT_SELECTOR)) {
        if (!isInputAvailable(input)) continue;
        if (input.id === id || input.name === id) return input;
        if (input.getAttribute("data-field-id") === id || input.getAttribute("data-id") === id) {
          return input;
        }

        let parent = input.parentElement;
        for (let depth = 0; depth < 12 && parent; depth += 1) {
          const pid = parent.id || "";
          const pname = parent.getAttribute?.("name") || "";
          const pdata = parent.getAttribute?.("data-field-id") || parent.getAttribute?.("data-id") || "";
          if (pid === id || pname === id || pdata === id || pid.endsWith(`_${id}`) || pid.endsWith(`-${id}`)) {
            return input;
          }
          parent = parent.parentElement;
        }
      }
    }

    const viaLabelId = findInputByFieldIdViaLabel(id);
    if (viaLabelId) return viaLabelId;

    const labelText = getLabelForField(id);
    if (labelText) {
      for (const candidate of getMatchingLabelsForField(id)) {
        const byLabel = findInputByLabelText(candidate, id);
        if (byLabel) return byLabel;
      }
    }

    return null;
  };

  const findInputInContainer = (container) => {
    if (!container) return null;
    if (container.matches?.("input,textarea,select")) return container;
    return container.querySelector?.("input,textarea,select,[contenteditable='true']");
  };

  const countEditableInputs = () => {
    let count = 0;
    for (const root of getSearchRoots()) {
      count += root.querySelectorAll?.("input:not([type=hidden]):not([readonly]),textarea:not([readonly]),select")?.length || 0;
    }
    return count;
  };

  const FORM_TABS = [
    { key: "applicant", label: /заявитель/i },
    { key: "manufacturer", label: /изготовитель/i },
    { key: "assembly", label: /сборочн/i },
    { key: "vehicle", label: /характеристик/i },
  ];

  const APPLICANT_FIELD_IDS = new Set([
    "textbox_address",
    "textbox_address_fact",
    "textbox_email",
    "textbox_phone",
    "textbox_address_kz",
    "textextbox_address",
  ]);

  const getFieldTab = (fieldId) => {
    const id = String(fieldId || "");
    if (APPLICANT_FIELD_IDS.has(id)) return "applicant";
    if (/manuf|juniae_copy1|reglink_manuf|legal_address/.test(id)) return "manufacturer";
    if (/assembly|juniae_copy3|reglink_assembly/.test(id)) return "assembly";
    return "vehicle";
  };

  let tabFieldOrder = new Map();

  const buildTabFieldOrder = () => {
    const order = new Map();
    const counters = { applicant: 0, manufacturer: 0, assembly: 0, vehicle: 0 };

    for (const item of formContext.lastData || []) {
      if (!item?.id || IGNORED_TYPES.has(item.type)) continue;
      const tab = getFieldTab(item.id);
      if (!order.has(item.id)) {
        order.set(item.id, { tab, index: counters[tab] });
        counters[tab] += 1;
      }
    }
    return order;
  };

  const refreshTabFieldOrder = () => {
    tabFieldOrder = buildTabFieldOrder();
  };

  const scrollFormToLoadFields = async () => {
    const roots = getSearchRoots();
    for (const root of roots) {
      const scrollEl = root.scrollingElement || root.documentElement || root.body;
      if (!scrollEl) continue;
      const max = scrollEl.scrollHeight || 0;
      for (let y = 0; y <= max; y += 500) {
        scrollEl.scrollTop = y;
        await sleep(40);
      }
      scrollEl.scrollTop = 0;
    }
    await sleep(150);
    fillSession.rowIndex = null;
  };

  const clickFormTab = async (tabPattern) => {
    for (const root of getSearchRoots()) {
      const nodes = root.querySelectorAll?.(
        'a, button, [role="tab"], .nav-tabs li, .tabs li, [class*="tab"]'
      ) || [];
      for (const el of nodes) {
        if (el.closest?.("#techreg-autofill-panel")) continue;
        const text = el.textContent.trim();
        if (!text || text.length > 90) continue;
        if (!tabPattern.test(text)) continue;
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.click();
        await sleep(900);
        fillSession.rowIndex = null;
        return true;
      }
    }
    return false;
  };

  const findDropdownOptions = (anchorInput) => {
    const selector = [
      "li[role='option']",
      "[role='listbox'] [role='option']",
      ".select2-results__option",
      ".ui-menu-item",
      ".ui-autocomplete li",
      "[class*='suggest'] li",
      "[class*='dropdown'] li",
      "[class*='listbox'] li",
      "[class*='autocomplete'] li",
      ".dropdown-menu li",
      "ul[class*='result'] li",
    ].join(",");

    const nodes = [];
    for (const root of getSearchRoots()) {
      nodes.push(...(root.querySelectorAll?.(selector) || []));
    }

    const visible = nodes.filter((node) => {
      if (!node.offsetParent) return false;
      const text = node.textContent.trim();
      return text && text !== "-" && text.length < 200;
    });

    if (!anchorInput) return visible;

    const rect = anchorInput.getBoundingClientRect();
    const near = visible.filter((node) => {
      const r = node.getBoundingClientRect();
      return Math.abs(r.top - rect.bottom) < 350 && Math.abs(r.left - rect.left) < 500;
    });
    return near.length ? near : visible;
  };

  const clickOptionElement = (target) => {
    if (!target) return;
    for (const type of ["mouseover", "mouseenter", "mousedown", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    target.click();
  };

  const pickOption = async (value, anchorInput) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return false;

    const firstToken = normalized.split(/[\s,/]+/)[0];

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const options = findDropdownOptions(anchorInput);
      if (options.length > 0) {
        const exact = options.find((node) => node.textContent.trim().toLowerCase() === normalized);
        const starts = options.find((node) => node.textContent.trim().toLowerCase().startsWith(normalized));
        const contains = options.find((node) => node.textContent.trim().toLowerCase().includes(normalized));
        const token = options.find((node) =>
          node.textContent.trim().toLowerCase().startsWith(firstToken)
        );
        const target = exact || starts || contains || token;
        if (target) {
          clickOptionElement(target);
          await sleep(200);
          return true;
        }
      }
      await sleep(200);
    }

    if (anchorInput) {
      anchorInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(120);
      anchorInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await sleep(120);
      const after = (anchorInput.value || anchorInput.textContent || "").trim();
      if (after && after !== "-") return true;
    }
    return false;
  };

  const typeIntoInput = async (input, text) => {
    input.focus();
    input.click();
    setNativeValue(input, "");
    await sleep(80);
    setNativeValue(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("keyup", { bubbles: true }));
    await sleep(60);
  };

  const setViaAsForm = (field) => {
    for (const asForm of collectAsForms()) {
      const existing = asForm.getField?.(field.id);
      if (!existing) continue;

      const value =
        field.key !== undefined && field.key !== null && field.key !== ""
          ? { value: field.value || "", key: field.key }
          : field.value || "";

      asForm.setValue?.(field.id, value);
      return true;
    }
    return false;
  };

  const setListLikeValue = async (field, value) => {
    if (setViaAsForm(field)) return true;

    const searchText = String(value || "").trim();
    if (!searchText) return false;

    const rowInputs = findRowInputsForField(field.id);
    const prefs = FIELD_INPUT_PREFS[field.id] || {};
    const dropdownInput =
      pickAvailableInput(rowInputs, prefs.preferInputIndex) ||
      (rowInputs ? rowInputs.find(isInputAvailable) : null) ||
      resolveFieldInput(field.id);
    const manualInput =
      rowInputs && rowInputs.length > 1
        ? rowInputs[prefs.manualInputIndex ?? rowInputs.length - 1]
        : null;

    if (!dropdownInput && manualInput && isInputAvailable(manualInput)) {
      log(`${field.id}: ручное поле → ${searchText.slice(0, 30)}`);
      await typeIntoInput(manualInput, searchText);
      manualInput.dispatchEvent(new Event("change", { bubbles: true }));
      markInputUsed(manualInput);
      return true;
    }

    const target = dropdownInput || resolveFieldInput(field.id);
    if (!target) return false;

    const input = findInputInContainer(target) || target;

    input.scrollIntoView?.({ block: "center", behavior: "instant" });
    await sleep(80);
    input.click();
    input.focus();
    await typeIntoInput(input, searchText);

    await sleep(field.type === "reglink" ? 1000 : 650);
    const picked = await pickOption(searchText, input);

    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    await sleep(120);

    const dropdownValue = String(input.value ?? "").trim();
    const dropdownOk =
      picked ||
      (dropdownValue && dropdownValue !== "-" && dropdownValue.toLowerCase().includes(searchText.toLowerCase().slice(0, 3)));

    if (dropdownOk) {
      markInputUsed(input);
      return true;
    }

    if (manualInput && isInputAvailable(manualInput) && manualInput !== input) {
      log(`${field.id}: справочник — пишу вручную → ${searchText.slice(0, 30)}`);
      await typeIntoInput(manualInput, searchText);
      manualInput.dispatchEvent(new Event("change", { bubbles: true }));
      markInputUsed(manualInput);
      return true;
    }

    return false;
  };

  const resolveFieldInput = (fieldId) => {
    const input = findInputForField(fieldId) || findFieldElement(fieldId);
    if (!input) return null;
    const target = findInputInContainer(input) || input;
    if (!isInputAvailable(target)) return null;
    return target;
  };

  const setSimpleValue = (field, value) => {
    if (setViaAsForm(field)) return true;

    const target = resolveFieldInput(field.id);
    if (!target) return false;

    if (target.isContentEditable) {
      target.textContent = String(value || "");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      setNativeValue(target, value);
    }
    markInputUsed(target);
    return true;
  };

  const setCheckOrRadio = (field) => {
    if (setViaAsForm(field)) return true;

    const shouldBeChecked = Array.isArray(field.values) ? field.values.includes("1") : String(field.value || "") === "1";
    const element = findFieldElement(field.id);
    if (!element) return false;
    const input = findInputInContainer(element) || element;
    if (input.type === "checkbox" || input.type === "radio") {
      input.checked = shouldBeChecked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  };

  const mergeFormData = (baseData, patchData) => {
    const map = new Map();
    for (const item of baseData || []) {
      if (item?.id) map.set(item.id, { ...item });
    }

    let patchedCount = 0;
    for (const field of patchData || []) {
      if (!field?.id || IGNORED_TYPES.has(field.type)) continue;

      const hasValue = String(field.value ?? "").trim() !== "";
      const hasKey = String(field.key ?? "").trim() !== "";
      if (!hasValue && !hasKey) continue;

      const prev = map.get(field.id) || { id: field.id, type: field.type };
      map.set(field.id, { ...prev, ...field });
      patchedCount += 1;
    }

    return { merged: Array.from(map.values()), patchedCount };
  };

  const ensureFormCache = (ctx) => {
    if (formContext.lastDataUuid && formContext.lastDataUuid !== ctx.uuid) {
      const prev = formContext.lastDataUuid;
      formContext.lastData = null;
      formContext.lastDataUuid = "";
      log(`Кэш сброшен: другая заявка (был uuid=${prev}, сейчас ${ctx.uuid})`);
    }
    return formContext.lastData;
  };

  const rememberAuthHeader = (value) => {
    if (!value || !String(value).toLowerCase().startsWith("basic ")) return;
    capturedAuthHeader = value;
    localStorage.setItem("techreg.autofill.auth", value);
  };

  const readHeadersAuth = (headers) => {
    if (!headers) return;
    if (headers instanceof Headers) {
      const auth = headers.get("Authorization") || headers.get("authorization");
      if (auth) rememberAuthHeader(auth);
      return;
    }
    if (typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === "authorization" && value) rememberAuthHeader(String(value));
      }
    }
  };

  const getSynergyAuthToken = () => {
    if (capturedAuthHeader) {
      return capturedAuthHeader.replace(/^Basic\s+/i, "");
    }
    for (const part of document.cookie.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith("constructor_creds_for_index=")) {
        return decodeURIComponent(trimmed.slice("constructor_creds_for_index=".length));
      }
    }
    return null;
  };

  const getSynergyHeaders = (extra = {}) => {
    const headers = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      ...extra,
    };
    const token = getSynergyAuthToken();
    if (token) {
      headers.Authorization = token.startsWith("Basic ") ? token : `Basic ${token}`;
    }
    return headers;
  };

  const synergyFetch = async (url, init = {}) => {
    const response = await fetch(url, {
      credentials: "include",
      ...init,
      headers: getSynergyHeaders(init.headers || {}),
    });
    if (response.status === 401) {
      const hasAuth = Boolean(getSynergyAuthToken());
      throw new Error(
        hasAuth
          ? "HTTP 401 — сессия истекла, перелогинься на techreg.gov.kz"
          : "HTTP 401 — нет cookie constructor_creds_for_index, перелогинься"
      );
    }
    return response;
  };

  const getFormContext = () => {
    const formInput = document.getElementById("techreg-autofill-form-id");
    const uuidInput = document.getElementById("techreg-autofill-record-id");
    const form = formInput?.value?.trim() || formContext.form;
    const uuid = uuidInput?.value?.trim() || formContext.uuid;
    return { form, uuid, lastData: formContext.lastData };
  };

  const fetchCurrentFormData = async (ctx) => {
    const query = new URLSearchParams({ form: ctx.form, uuid: ctx.uuid });
    const getResponse = await synergyFetch(`${SYNERGY_SAVE_URL}?${query.toString()}`);
    if (getResponse.ok) {
      return parseDataArray(await getResponse.text());
    }

    const postBody = new URLSearchParams({ form: ctx.form, uuid: ctx.uuid });
    const postResponse = await synergyFetch(SYNERGY_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: postBody.toString(),
    });
    if (!postResponse.ok) {
      throw new Error(`загрузка формы HTTP ${getResponse.status}/${postResponse.status}`);
    }
    return parseDataArray(await postResponse.text());
  };

  const MIN_FORM_FIELDS = 100;

  const submitViaSynergyApi = async (patchData) => {
    const ctx = getFormContext();
    if (!ctx.form || !ctx.uuid) {
      throw new Error("нет form/uuid — открой заявку или укажи Form ID и Record ID в панели");
    }

    let base = ensureFormCache(ctx);
    if (!base?.length) {
      log("Загружаю текущие данные формы...");
      try {
        base = await fetchCurrentFormData(ctx);
        if (base?.length) {
          formContext.lastData = base;
          formContext.lastDataUuid = ctx.uuid;
        }
      } catch (error) {
        log(`WARN: ${error.message}`);
        base = [];
      }
    }

    if ((base?.length || 0) < MIN_FORM_FIELDS) {
      throw new Error(
        `в кэше только ${base?.length || 0} полей — сначала открой заявку на techreg, подожди 2–3 сек, Diag → cached=600+, потом API Save`
      );
    }

    const { merged, patchedCount } = mergeFormData(base, patchData);
    const body = new URLSearchParams({
      data: `"data" : ${JSON.stringify(merged)}`,
      form: ctx.form,
      uuid: ctx.uuid,
    });

    const response = await synergyFetch(SYNERGY_SAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = (await response.text()).slice(0, 200);
      throw new Error(`Synergy API HTTP ${response.status}${errText ? `: ${errText}` : ""}`);
    }

    formContext.lastData = merged;
    formContext.lastDataUuid = ctx.uuid;
    refreshFieldLabelMap();
    log(`Сервер: ${patchedCount} полей из портала (uuid=${ctx.uuid})`);
    return true;
  };

  const requireEditMode = () => {
    const editable = countEditableInputs();
    if (editable === 0) {
      throw new Error('Сначала нажми «Редактировать» на форме techreg, потом Fill');
    }
    return editable;
  };

  const mirrorApplicantLegalAddress = async (fields) => {
    const value =
      fields.find((f) => f.id === "textbox_address_fact")?.value ||
      fields.find((f) => f.id === "textbox_address")?.value;
    if (!String(value || "").trim()) return false;

    fillSession.rowIndex = null;
    const field = { id: "textbox_address", type: "textbox", value };
    const ok = setSimpleValue(field, value);
    if (ok) log("  юр. адрес ← тот же что фактический");
    return ok;
  };

  const fillFieldsOnCurrentTab = async (fields) => {
    let applied = 0;
    let skipped = 0;
    let warnCount = 0;

    for (const field of fields) {
      if (!field?.id || IGNORED_TYPES.has(field.type) || SKIP_FIELD_IDS.has(field.id)) {
        skipped += 1;
        continue;
      }

      const hasValue = String(field.value ?? "").trim() !== "";
      const hasKey = String(field.key ?? "").trim() !== "";
      if (!hasValue && !hasKey) {
        skipped += 1;
        continue;
      }

      try {
        let ok = false;
        if (field.type === "listbox" || field.type === "reglink") {
          ok = await setListLikeValue(field, field.value || "");
        } else if (field.type === "check" || field.type === "radio") {
          ok = setCheckOrRadio(field);
        } else {
          ok = setSimpleValue(field, field.value || "");
        }

        if (ok) applied += 1;
        else {
          skipped += 1;
          if (warnCount < 2) {
            const label = getLabelForField(field.id);
            log(`WARN: ${field.id}${label ? ` (${label})` : ""}`);
            warnCount += 1;
          }
        }
      } catch (error) {
        skipped += 1;
        log(`ERR ${field.id}: ${error.message}`);
      }

      await sleep(field.type === "reglink" ? 120 : 60);
    }

    return { applied, skipped, warnCount };
  };

  const fillScreenFromPayload = async (data) => {
    refreshFieldLabelMap();
    refreshTabFieldOrder();
    resetFillSession();
    requireEditMode();

    const sorted = [...data].sort((a, b) => {
      const la = getLabelForField(a?.id)?.length || 0;
      const lb = getLabelForField(b?.id)?.length || 0;
      return lb - la;
    });

    const byTab = new Map(FORM_TABS.map((t) => [t.key, []]));
    for (const field of sorted) {
      const tab = getFieldTab(field.id);
      byTab.get(tab)?.push(field);
    }

    let totalApplied = 0;
    let totalSkipped = 0;

    for (const tab of FORM_TABS) {
      const fields = byTab.get(tab.key) || [];
      const withData = fields.filter((f) => {
        const hasValue = String(f.value ?? "").trim() !== "";
        const hasKey = String(f.key ?? "").trim() !== "";
        return hasValue || hasKey;
      });
      if (!withData.length) continue;

      log(`Вкладка: ${tab.key} (${withData.length} полей)`);
      const clicked = await clickFormTab(tab.label);
      if (!clicked && tab.key !== "vehicle") {
        log(`WARN: вкладка не найдена: ${tab.key}`);
      }
      resetTabFillSession(tab.key);
      await scrollFormToLoadFields();
      const rowCount = getFormRowIndex().length;
      log(`  строк на экране: ${rowCount}`);

      const { applied, skipped, warnCount } = await fillFieldsOnCurrentTab(withData);
      if (tab.key === "applicant") {
        await mirrorApplicantLegalAddress(withData);
      }
      totalApplied += applied;
      totalSkipped += skipped;
      if (warnCount > 0 && skipped > warnCount) {
        log(`  пропущено ещё ${skipped - warnCount}`);
      }
      log(`  заполнено ${applied}`);
    }

    log(`Итого: ${totalApplied} заполнено, ${totalSkipped} пропущено`);
    return totalApplied;
  };

  const applyPayload = async (payload, mode = "fill") => {
    const data = Array.isArray(payload?.data) ? payload.data : [];
    if (!data.length) throw new Error("Пустой payload.data");

    if (mode === "server") {
      await submitViaSynergyApi(data);
      return;
    }

    const applied = await fillScreenFromPayload(data);

    if (applied > 0) {
      log("Готово — проверь поля и нажми «Сохранить» или «Завершить» на techreg");
      log("(F5 не нужен — не обновляй страницу)");
      return;
    }

    log("На экране ничего не заполнилось — пробую записать на сервер...");
    try {
      await submitViaSynergyApi(data);
      log("Данные на сервере, но экран пустой — всё равно нажми «Сохранить» на techreg");
    } catch (error) {
      log(`Сервер: ${error.message}`);
      throw new Error("Не удалось заполнить экран. Убедись что нажато «Редактировать».");
    }
  };

  const fetchPayload = async (apiBase, applicationId) => {
    const url = `${apiBase.replace(/\/+$/, "")}/api/applications/${encodeURIComponent(applicationId)}/techreg-payload`;
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  };

  const runDiagnose = () => {
    scrapeFormContextFromPage();
    const ctx = getFormContext();
    const editable = countEditableInputs();
    const asForms = collectAsForms().length;
    const ctxError = validateTechregContext(ctx);
    const sample = [];
    for (const root of getSearchRoots()) {
      for (const el of root.querySelectorAll?.("input[id*='textbox'],textarea[id*='textarea']") || []) {
        if (sample.length >= 5) break;
        sample.push(el.id || el.name);
      }
    }
    log(`DIAG: editable inputs=${editable}, AS.forms=${asForms}`);
    log(`DIAG: auth=${getSynergyAuthToken() ? "есть" : "НЕТ — нажми Сохранить на форме или перелогинься"}`);
    log(`DIAG: form=${ctx.form || "—"}, uuid=${ctx.uuid || "—"}, cached=${ctx.lastData?.length || 0} (uuid кэша=${formContext.lastDataUuid || "—"})`);
    if (ctxError) log(`DIAG ERR: ${ctxError}`);
    if ((ctx.lastData?.length || 0) >= MIN_FORM_FIELDS) {
      log(`DIAG: кэш меток полей=${fieldLabelMap.size} — Fill должен находить поля по подписям`);
    } else {
      log("DIAG: малый кэш — открой заявку, подожди загрузки (для подписей полей)");
    }
    log(`DIAG: режим=${countEditableInputs() > 0 ? "редактирование ✓" : "просмотр — нажми Редактировать"}`);
    const sampleRows = buildFormRowIndex().slice(0, 6).map((r) => r.label.slice(0, 35));
    if (sampleRows.length) log(`DIAG: строки формы: ${sampleRows.join(" | ")}`);
    if (sample.length) log(`DIAG sample ids: ${sample.join(", ")}`);
    else log("DIAG: input с id textbox_* на странице нет (норма для Synergy)");
  };

  const buildUi = () => {
    const root = document.createElement("div");
    root.id = "techreg-autofill-panel";
    root.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:999999",
      "width:340px",
      "background:#111827",
      "color:#fff",
      "padding:12px",
      "border-radius:10px",
      "box-shadow:0 10px 30px rgba(0,0,0,.35)",
      "font:12px/1.4 Arial,sans-serif",
    ].join(";");

    root.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px">Techreg Autofill</div>
      <label style="display:block;margin-bottom:4px">API base (портал)</label>
      <input id="techreg-autofill-api" style="width:100%;margin-bottom:8px;padding:6px;border-radius:6px;border:1px solid #374151;background:#0f172a;color:#fff" />
      <label style="display:block;margin-bottom:4px">Application ID</label>
      <input id="techreg-autofill-app-id" style="width:100%;margin-bottom:8px;padding:6px;border-radius:6px;border:1px solid #374151;background:#0f172a;color:#fff" />
      <label style="display:block;margin-bottom:4px">Form ID (UUID шаблона techreg)</label>
      <input id="techreg-autofill-form-id" placeholder="0a89f184-1655-4d92-89ca-dca5d81fcb96" style="width:100%;margin-bottom:8px;padding:6px;border-radius:6px;border:1px solid #374151;background:#0f172a;color:#fff" />
      <label style="display:block;margin-bottom:4px">Record ID (uuid записи techreg)</label>
      <input id="techreg-autofill-record-id" placeholder="28128311" style="width:100%;margin-bottom:8px;padding:6px;border-radius:6px;border:1px solid #374151;background:#0f172a;color:#fff" />
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <button id="techreg-autofill-run" style="flex:1;min-width:100px;padding:8px;border:0;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer">Fill</button>
        <button id="techreg-autofill-api-only" style="flex:1;min-width:100px;padding:8px;border:0;border-radius:6px;background:#334155;color:#fff;cursor:pointer" title="Только на сервер, без экрана">Server</button>
        <button id="techreg-autofill-diag" style="padding:8px;border:0;border-radius:6px;background:#334155;color:#fff;cursor:pointer">Diag</button>
        <button id="techreg-autofill-copy-log" style="padding:8px;border:0;border-radius:6px;background:#334155;color:#fff;cursor:pointer" title="Скопировать весь лог">Copy log</button>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">Fill ~30–60 сек (Tampermonkey крутится — это норма)</div>
      <textarea id="techreg-autofill-log" readonly style="width:100%;height:140px;padding:6px;border-radius:6px;border:1px solid #374151;background:#020617;color:#cbd5e1;font-family:Consolas,monospace;font-size:11px"></textarea>
    `;

    document.body.appendChild(root);

    const apiInput = root.querySelector("#techreg-autofill-api");
    const appIdInput = root.querySelector("#techreg-autofill-app-id");
    const formInput = root.querySelector("#techreg-autofill-form-id");
    const recordInput = root.querySelector("#techreg-autofill-record-id");

    apiInput.value = localStorage.getItem("techreg.autofill.api") || DEFAULT_API;
    appIdInput.value = localStorage.getItem("techreg.autofill.appId") || "";
    formInput.value = formContext.form;
    recordInput.value = formContext.uuid;

    const saveSettings = () => {
      localStorage.setItem("techreg.autofill.api", apiInput.value.trim());
      localStorage.setItem("techreg.autofill.appId", appIdInput.value.trim());
      formContext.form = formInput.value.trim();
      formContext.uuid = recordInput.value.trim();
      persistFormContext();
    };

    const runFill = async (mode) => {
      saveSettings();
      const apiBase = apiInput.value.trim();
      const appId = appIdInput.value.trim();
      const fillBtn = root.querySelector("#techreg-autofill-run");
      const serverBtn = root.querySelector("#techreg-autofill-api-only");

      if (!appId) {
        log("ERR: укажи Application ID");
        return;
      }

      fillBtn.disabled = true;
      serverBtn.disabled = true;
      fillBtn.textContent = mode === "fill" ? "Fill…" : fillBtn.textContent;
      serverBtn.textContent = mode === "server" ? "Server…" : serverBtn.textContent;

      try {
        log(`--- Fill v0.4.4 (${mode}) ---`);
        log(`Fetch payload for ${appId}`);
        const payload = await fetchPayload(apiBase, appId);
        log(`Payload loaded: ${Array.isArray(payload?.data) ? payload.data.length : 0} fields`);
        await applyPayload(payload, mode);
        log("--- конец Fill ---");
      } catch (error) {
        log(`ERR: ${error.message}`);
      } finally {
        fillBtn.disabled = false;
        serverBtn.disabled = false;
        fillBtn.textContent = "Fill";
        serverBtn.textContent = "Server";
      }
    };

    root.querySelector("#techreg-autofill-run").addEventListener("click", () => runFill("fill"));
    root.querySelector("#techreg-autofill-api-only").addEventListener("click", () => runFill("server"));
    root.querySelector("#techreg-autofill-diag").addEventListener("click", runDiagnose);
    root.querySelector("#techreg-autofill-copy-log").addEventListener("click", async () => {
      const area = document.getElementById("techreg-autofill-log");
      const text = area?.value || "";
      if (!text) {
        log("Лог пустой");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        log("Лог скопирован в буфер — вставь Ctrl+V сюда в чат");
      } catch {
        area.focus();
        area.select();
        document.execCommand("copy");
        log("Лог выделен — Ctrl+C, потом вставь в чат");
      }
    });
  };

  const initPanel = () => {
    if (window.self !== window.top) return;
    if (document.getElementById("techreg-autofill-panel")) return;
    if (!document.body) return false;

    buildUi();
    log("Ready v0.4.4 — Редактировать → Fill → Copy log");
    return true;
  };

  const boot = () => {
    if (initPanel()) return;

    const observer = new MutationObserver(() => {
      if (initPanel()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
