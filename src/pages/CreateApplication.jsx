import { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { useLocation } from "react-router-dom";
import { buildCharacteristics } from "../utils/buildCharacteristics";
import { loadRoboto } from "../fonts/roboto";
// import loadTimes from "../fonts/loadTimes";
import autoTable from "jspdf-autotable";
import { useNavigate, useParams } from "react-router-dom";
import formatDateRu from "../utils/formatDateRu";
import { API_URL } from "../config";
import TimerTracker from "../components/TimerTracker";
import { createLogEntry } from "../utils/timeTracker";
import "../styles/CreateApplication.css";

const isMCategory = (category) => {
  const c = String(category || "").trim().toLowerCase();
  return c.startsWith("m");
};

const isN3Category = (category) => {
  const c = String(category || "").trim().toLowerCase();
  return c.startsWith("n3");
};

const isOCategory = (category) => {
  const c = String(category || "").trim().toLowerCase();
  return (
    c.startsWith("o1") ||
    c.startsWith("o2") ||
    c.startsWith("o3") ||
    c.startsWith("o4")
  );
};

const needsFuelSelect = (category) => {
  const c = String(category || "").trim().toLowerCase();

  if (!c) return false;
  if (isOCategory(c)) return false;
  if (isN3Category(c)) return false;

  return c.startsWith("m") || c.startsWith("n1") || c.startsWith("n2");
};

const getTemplateCategory = (category) => {
  const c = String(category || "").trim().toUpperCase();

  if (c === "N1G") return "N1";
  if (c === "N2G") return "N2";
  if (c === "N3G") return "N3";
  if (c === "M1G") return "M1";
  if (c === "M2G") return "M2";
  if (c === "M3G") return "M3";

  return c;
};

const docFieldConfigs = [
  { key: "udostoverenie", label: "удостоверение" },
  { key: "ownershipDoc", label: "о владении ТС" },
  { key: "techDescription", label: "тех описание" },
  { key: "actDoc", label: "АКТ" },
  { key: "other1", label: "Прочее 1" },
  { key: "other2", label: "Прочее 2" },
  { key: "other3", label: "Прочее 3" },
  { key: "other4", label: "Прочее 4" },
];

const getStoredFileNameSafe = (file) => {
  if (typeof file === "object" && file !== null) {
    return file.filename || "";
  }
  return file || "";
};

const getOriginalFileNameSafe = (file) => {
  if (typeof file === "object" && file !== null) {
    return file.originalname || file.filename || "Без имени";
  }

  if (typeof file === "string" && file.trim()) {
    return file;
  }

  return "Без имени";
};

const isImageName = (name) => /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(name || "");
const normalizeProtocol = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.padStart(4, "0");
};

const fuelOptions = ["Бензин", "Дизель", "Электро"];

const AUTO_FILL_EXCLUDED_KEYS = new Set([
  "_id",
  "files",
  "status1",
  "fio",
  "iin",
  "address",
  "phone",
  "email",
  "broker",
  "createdAt",
  "protocolDate",
  "protocolNumber",
]);

const normalizeCompareValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeFuelValue = (value) => normalizeCompareValue(value).replace("ё", "е");

const matchesFuel = (car, fuelType) => {
  if (!fuelType) return true;
  const selected = normalizeFuelValue(fuelType);
  const carFuel = normalizeFuelValue(car?.fuelType || car?.fuel || "");
  if (!carFuel) return selected === "электро";
  if (selected === "бензин" || selected.includes("сжиженный") || selected.includes("газ")) {
    return (
      carFuel.includes("бенз") ||
      carFuel.includes("газ") ||
      carFuel.includes("lpg") ||
      carFuel.includes("gpl")
    );
  }
  if (selected === "дизель") return carFuel.includes("диз");
  if (selected === "электро") return carFuel.includes("элект");
  return carFuel.includes(selected);
};

const isEqualLoose = (left, right) => {
  const a = normalizeCompareValue(left);
  const b = normalizeCompareValue(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aNum = Number(a.replace(",", "."));
  const bNum = Number(b.replace(",", "."));
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return Math.abs(aNum - bNum) < 0.0001;
  }
  return false;
};

const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });
const sortAlpha = (arr) => [...arr].sort((a, b) => collator.compare(String(a), String(b)));
const sortNumericAsc = (arr) =>
  [...arr].sort((a, b) => Number(String(a).replace(",", ".")) - Number(String(b).replace(",", ".")));

const groupByFirstLetter = (items) => {
  const grouped = new Map();
  items.forEach((item) => {
    const text = String(item || "").trim();
    if (!text) return;
    const letter = text[0].toUpperCase();
    const prev = grouped.get(letter) || [];
    prev.push(text);
    grouped.set(letter, prev);
  });
  return [...grouped.entries()]
    .sort((a, b) => collator.compare(a[0], b[0]))
    .map(([letter, values]) => ({ letter, values: sortAlpha(values) }));
};

export default function CreateApplication() {
  const [darkMode, setDarkMode] = useState(
  () => localStorage.getItem("theme") === "dark"
);

useEffect(() => {
  if (darkMode) {
    document.body.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}, [darkMode]);
  const [form, setForm] = useState({
    type: "",
    typ: "",
    brand: "",
    model: "",
    year: "",
    volume: "",
    vin: "",
    category: "",
    templateCategory: "",
    EcologicalClass: "",
    fio: "",
    iin: "",
    address: "",
    phone: "",
    email: "",
    broker: "",
    MANUFACTURER: "",
    legaladdressoftheMANUFACTURER: "",
    actualaddressoftheMANUFACTURER: "",
    ASSEMBLYPLANT: "",
    addressoftheassemblyplant: "",
    createdAt: "",
    seats: "",
    cab: "",
    frame: "",
    bodyType: "",
    loadSpace: "",
    axles: "",
    curbWeight: "",
    maxWeight: "",
    length: "",
    width: "",
    height: "",
    base: "",
    Wheeltrack: "",
    Descriptionhybrid: "",
    compressionratio: "",
    tires: "",
    chassis: "",
    engine: "",
    cylinderVolume: "",
    cylinders: "",
    power: "",
    fuel: "",
    fuelType: "",
    n3Type: "",
    Ignitionsystem: "",
    Exhaustsystem: "",
    Powersystem: "",
    Energystorage: "",
    Electricmachine: "",
    transmission: "",
    clutch: "",
    frontSuspension: "",
    rearSuspension: "",
    steering: "",
    brakes: "",
    extraEquipment: "",
    electricMotor: "",
    batterySystem: "",
    emVoltage: "",
    emVoltage1: "",
    maxPowerEM: "",
    maxPowerEM1: "",
    Transmissionbox: "",
    brakes1: "",
    brakes2: "",
    brakes3: "",
    status1: "",
    files: {},
  });

  const [cars, setCars] = useState([]);
  const [files, setFiles] = useState({});
  const [filesUploaded, setFilesUploaded] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);

  const [protocolNumber, setProtocolNumber] = useState("");
  const [protocolDate, setProtocolDate] = useState("");
  const [noiseValue, setNoiseValue] = useState("");
  const [gasValue, setGasValue] = useState("");
  const [coMin, setCoMin] = useState("");
  const [coMax, setCoMax] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [pressure, setPressure] = useState("");
  const [smokeValue, setSmokeValue] = useState("");
  const [showProtocolModal, setShowProtocolModal] = useState(false);

  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionNumber, setDecisionNumber] = useState("");
  const [decisionDate, setDecisionDate] = useState("");

  const [showDogovorModal, setShowDogovorModal] = useState(false);
  const [dogovorNumber, setDogovorNumber] = useState("");
  const [dogovorDate, setDogovorDate] = useState("");

  const [showZayavkaModal, setShowZayavkaModal] = useState(false);
  const [zayavkaNumber, setZayavkaNumber] = useState("");
  const [zayavkaDate, setZayavkaDate] = useState("");
const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const ocrGalleryRef = useRef(null);
  const ocrCameraRef = useRef(null);
  const ocrDocsRef = useRef(null);
  const [ocrTarget, setOcrTarget] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDebug, setOcrDebug] = useState("");
  const ocrDocumentRef = useRef(null);

  const effectiveFuelType = isN3Category(form.templateCategory)
    ? "Дизель"
    : form.fuelType;

  const protocolFuel = String(effectiveFuelType || "").trim().toLowerCase();
  const isBenzin = protocolFuel === "бензин";
  const isDiesel = protocolFuel === "дизель";
  const isElectro =
    protocolFuel === "электро" || protocolFuel === "электрический";

  useEffect(() => {
    const loadCars = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/cars`);
        setCars(res.data);
      } catch (err) {
        console.error("Ошибка загрузки машин:", err);
      }
    };
    loadCars();
  }, []);

  useEffect(() => {
  const copiedState = location.state?.copyFrom || location.state?.copiedData;
  if (!copiedState || cars.length === 0) return;
  const selectedCar = { ...copiedState };
  delete selectedCar.protocolNumber;

  setForm((prev) => ({
    ...prev,
    ...selectedCar,
  }));
}, [cars, location.state]);

  useEffect(() => {
    if (id) return;
    axios
      .get(`${API_URL}/api/applications/next-protocol-number`)
      .then((res) => {
        const formatted = res.data?.formatted || "";
        if (formatted) setProtocolNumber(formatted);
      })
      .catch((err) => console.error("Ошибка next protocol:", err));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const formatDate = (date) =>
      date ? new Date(date).toISOString().split("T")[0] : "";

    axios
      .get(`${API_URL}/api/applications/${id}`)
      .then((res) => {
        const data = res.data;

        setForm({
          ...data,
          templateCategory: getTemplateCategory(data.category),
          createdAt: formatDate(data.createdAt),
          protocolDate: formatDate(data.protocolDate),
        });
        setProtocolNumber(normalizeProtocol(data.protocolNumber));

        const loadedFiles = [];

        Object.entries(data.files || {}).forEach(([key, arr]) => {
          (arr || []).forEach((file, index) => {
            loadedFiles.push({
              key,
              savedName: getStoredFileNameSafe(file),
              originalName: getOriginalFileNameSafe(file),
              isExisting: true,
              index,
            });
          });
        });

        setExistingFiles(loadedFiles);
      })
      .catch((err) => {
        console.error(err);
        alert("Заявка не найдена");
      });
  }, [id]);

  

  const characteristics = useMemo(() => buildCharacteristics(form), [form]);

  const carsByFuel = useMemo(
    () => cars.filter((car) => matchesFuel(car, form.fuelType)),
    [cars, form.fuelType]
  );

  const typeOptions = useMemo(
    () => sortAlpha([...new Set(carsByFuel.map((c) => c.type).filter(Boolean))]),
    [carsByFuel]
  );

  const brandOptions = useMemo(
    () =>
      sortAlpha([
        ...new Set(
          carsByFuel
            .filter((c) => !form.type || c.type === form.type)
            .map((c) => c.brand)
            .filter(Boolean)
        ),
      ]),
    [carsByFuel, form.type]
  );
  const brandOptionGroups = useMemo(() => groupByFirstLetter(brandOptions), [brandOptions]);

  const modelOptions = useMemo(
    () =>
      sortAlpha([
        ...new Set(
          carsByFuel
            .filter((c) => (!form.type || c.type === form.type) && (!form.brand || c.brand === form.brand))
            .map((c) => c.model)
            .filter(Boolean)
        ),
      ]),
    [carsByFuel, form.type, form.brand]
  );

  const yearOptions = useMemo(
    () =>
      sortNumericAsc([
        ...new Set(
          carsByFuel
            .filter(
              (c) =>
                (!form.type || c.type === form.type) &&
                (!form.brand || c.brand === form.brand) &&
                (!form.model || c.model === form.model)
            )
            .map((c) => c.year)
            .filter((y) => y !== undefined && y !== null && y !== "")
        ),
      ]),
    [carsByFuel, form.type, form.brand, form.model]
  );

  const volumeOptions = useMemo(
    () =>
      sortNumericAsc([
        ...new Set(
          carsByFuel
            .filter(
              (c) =>
                (!form.type || c.type === form.type) &&
                (!form.brand || c.brand === form.brand) &&
                (!form.model || c.model === form.model) &&
                (!form.year || Number(c.year) === Number(form.year))
            )
            .map((c) => c.volume)
            .filter((v) => v !== undefined && v !== null && v !== "")
        ),
      ]),
    [carsByFuel, form.type, form.brand, form.model, form.year]
  );

  useEffect(() => {
    if (!cars.length) return;
    if (!form.type || !form.brand || !form.model) return;

    const matched = cars.find((car) => {
      if (!isEqualLoose(car.type, form.type)) return false;
      if (!isEqualLoose(car.brand, form.brand)) return false;
      if (!isEqualLoose(car.model, form.model)) return false;

      if (form.year && !isEqualLoose(car.year, form.year)) return false;
      if (form.volume && !isEqualLoose(car.volume, form.volume)) return false;
      return true;
    });

    if (!matched) return;

    setForm((prev) => {
      const autoFill = {};
      Object.entries(matched).forEach(([key, value]) => {
        if (AUTO_FILL_EXCLUDED_KEYS.has(key)) return;
        autoFill[key] = value;
      });

      const next = {
        ...prev,
        ...autoFill,
        type: prev.type,
        brand: prev.brand,
        model: prev.model,
        year: prev.year || String(matched.year ?? ""),
        volume: prev.volume || String(matched.volume ?? ""),
      };

      const changed = Object.keys(next).some((key) => String(next[key] ?? "") !== String(prev[key] ?? ""));
      return changed ? next : prev;
    });
  }, [cars, form.type, form.brand, form.model, form.year, form.volume]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "templateCategory") {
        if (isN3Category(value)) {
          next.fuelType = "Дизель";
          next.n3Type = "";
        } else if (isOCategory(value)) {
          next.fuelType = "";
          next.n3Type = "";
          next.EcologicalClass = "";
        } else if (needsFuelSelect(value)) {
          next.fuelType = "";
          next.n3Type = "";
        } else {
          next.fuelType = "";
          next.n3Type = "";
        }
      }

      if (name === "fuelType" && isN3Category(prev.templateCategory)) {
        next.fuelType = "Дизель";
      }
      if (name === "fuelType") {
        next.type = "";
        next.brand = "";
        next.model = "";
        next.year = "";
        next.volume = "";
      }
      if (name === "type") {
        next.brand = "";
        next.model = "";
        next.year = "";
        next.volume = "";
      }
      if (name === "brand") {
        next.model = "";
        next.year = "";
        next.volume = "";
      }
      if (name === "model") {
        next.year = "";
        next.volume = "";
      }
      if (name === "year") {
        next.volume = "";
      }

      return next;
    });
  };

  const handleFileChange = (e, key) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setFiles((prev) => {
      if (key === "photos") {
        return {
          ...prev,
          [key]: [...(prev[key] || []), ...selectedFiles],
        };
      }

      return {
        ...prev,
        [key]: selectedFiles[0],
      };
    });

    setFilesUploaded((prev) => {
      if (key === "photos") {
        return [
          ...prev,
          ...selectedFiles.map((file, index) => ({
            key,
            savedName: file.name,
            originalName: file.name,
            isExisting: false,
            index,
          })),
        ];
      }
      return [
        ...prev.filter((item) => item.key !== key),
        {
          key,
          savedName: selectedFiles[0].name,
          originalName: selectedFiles[0].name,
          isExisting: false,
          index: 0,
        },
      ];
    });

    if (key !== "photos") {
      setExistingFiles((prev) => prev.filter((item) => item.key !== key));
      setForm((prev) => ({
        ...prev,
        files: {
          ...(prev.files || {}),
          [key]: [],
        },
      }));
    }
  };

  const parseRecognizedTextByField = (field, rawText) => {
    const raw = String(rawText || "");
    const clean = raw.replace(/\s+/g, " ").trim();
    if (!clean) return "";

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const sanitizeName = (value) =>
      String(value || "")
        .replace(/[^A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ\s.-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const stripFioLabelNoise = (value) =>
      sanitizeName(
        String(value || "")
          .replace(
            /\b(тегі|тегi|фамили[яи]?|аты|имя|атыимя|аты\/имя|әкес[іi]н[іi]ң|әкес[іi]н|әкес[іi]|әкесінаты|екесінаты|отчеств[оа]?|middle\s*name)\b/gi,
            " "
          )
          .replace(/\s+/g, " ")
      );

    const finalizeFio = (value) => {
      const normalized = stripFioLabelNoise(
        String(value || "")
          .replace(/\b(аты)\s+(имя)\b/gi, " ")
          .replace(/\b(тегі|тегi)\s+(фамили[яи]?)\b/gi, " ")
          .replace(/\b(әкес[іi]н[іi]ң)\s+(аты|отчество)\b/gi, " ")
      );
      const tokens = normalized
        .split(/\s+/)
        .filter(Boolean)
        .filter((part) => part.length > 1)
        .filter(
          (part) =>
            !/^(аты|имя|отчество|тегі|тегi|әкесі|әкесi|екесінаты|әкесінаты)$/i.test(part)
        );
      const cleaned = tokens.filter((part) => !/^әкес/i.test(part) && !/^отчеств/i.test(part));
      return cleaned.slice(0, 3).join(" ").trim();
    };

    const findByLabel = (labelRegex) => {
      const idx = lines.findIndex((line) => labelRegex.test(line.toLowerCase()));
      if (idx === -1) return "";
      const sameLine = lines[idx].replace(labelRegex, "").replace(/[:\-]/g, "").trim();
      if (sameLine) return sameLine;
      return lines[idx + 1] || "";
    };

    const extractVinStrict = () => {
      const normalizeVinText = (value) =>
        String(value || "")
          .toUpperCase()
          .replace(/[О]/g, "0")
          .replace(/[О]/g, "0")
          .replace(/[IІ|]/g, "1")
          .replace(/[L]/g, "1")
          .replace(/[S]/g, "5")
          .replace(/[B]/g, "8")
          .replace(/[Z]/g, "2")
          .replace(/[^A-Z0-9]/g, " ");

      // 1) Попытка по метке VIN
      const vinByLabel = findByLabel(/vin/i);
      const labelNormalized = normalizeVinText(vinByLabel).replace(/\s+/g, "");
      if (labelNormalized.length >= 17) {
        const m = labelNormalized.match(/[A-HJ-NPR-Z0-9]{17}/);
        if (m?.[0]) return m[0];
      }

      // 2) По всему тексту: обычный поиск 17-символьного VIN
      const allNormalized = normalizeVinText(raw);
      const direct = allNormalized.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      if (direct?.[0]) return direct[0];

      // 3) Если OCR разбил VIN на куски — склеиваем "похожие" токены
      const tokens = allNormalized
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => /^[A-Z0-9]+$/.test(t));

      for (let i = 0; i < tokens.length; i += 1) {
        let merged = "";
        for (let j = i; j < tokens.length && merged.length < 24; j += 1) {
          merged += tokens[j];
          if (merged.length >= 17) {
            const m = merged.match(/[A-HJ-NPR-Z0-9]{17}/);
            if (m?.[0]) return m[0];
          }
        }
      }

      // 4) Очень шумный случай — берем первую 17-символьную подстроку
      const compact = allNormalized.replace(/\s+/g, "");
      const fallback = compact.match(/[A-HJ-NPR-Z0-9]{17}/);
      return fallback?.[0] || "";
    };
    const pickSegmentByLabels = (labelRegex, stopRegex) => {
      const m = raw.match(
        new RegExp(
          `${labelRegex.source}\\s*[:\\-/]?\\s*([\\s\\S]{1,80}?)(?=${stopRegex.source}|$)`,
          "i"
        )
      );
      return m?.[1] || "";
    };

    const extractIinStrict = () => {
      const labeled = findByLabel(/(иин|жсн)/i).replace(/\D/g, "");
      if (labeled.length >= 12) return labeled.slice(0, 12);
      const exact = raw.match(/(?:^|\D)(\d{12})(?!\d)/g) || [];
      const normalized = exact
        .map((chunk) => String(chunk).replace(/\D/g, ""))
        .filter((value) => value.length === 12);
      return normalized[0] || "";
    };

    const extractFioStrict = () => {
      const stopWords = [
        "республика", "удостоверение", "личности", "дата", "рождения", "пол",
        "жынысы", "орган", "выдан", "действителен", "номер", "vin", "иин", "жсн",
        "министр", "министерство", "внутренних", "дел", "ішкі", "істер", "берген", "орган",
        "облысы", "область", "национальность", "туған", "жері", "место", "рождения",
      ];
      const hasCyrillic = (text) => /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ]/.test(String(text || ""));
      const normalizeLine = (line) =>
        stripFioLabelNoise(String(line || "").replace(/[./,;:_]+/g, " ").replace(/\s+/g, " ").trim());
      const looksLikePersonLine = (line) => {
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length < 2 || parts.length > 3) return false;
        if (parts.some((p) => p.length < 2)) return false;
        if (parts.some((p) => /\d/.test(p))) return false;
        if (!hasCyrillic(parts.join(" "))) return false;
        return parts.every((p) => /^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]+$/.test(p));
      };

      // 1) Стратегия "якорь по дате рождения / ИИН": берем 2-3 строки прямо перед якорем.
      const dateIdx = lines.findIndex((line) =>
        /(?:\b\d{2}[.\-/]\d{2}[.\-/]\d{4}\b|дата\s*рожд|туған\s*күні)/i.test(line)
      );
      const iinIdx = lines.findIndex((line) =>
        /(?:\b\d{12}\b|иин|жсн)/i.test(line)
      );
      const anchorIdx = dateIdx >= 0 ? dateIdx : iinIdx;
      if (anchorIdx > 0) {
        const beforeAnchor = lines
          .slice(Math.max(0, anchorIdx - 5), anchorIdx)
          .map((line) => normalizeLine(line))
          .filter(Boolean)
          .filter((line) => {
            const low = line.toLowerCase();
            return !stopWords.some((word) => low.includes(word));
          })
          .filter((line) => looksLikePersonLine(line));

        if (beforeAnchor.length) {
          // Обычно Фамилия/Имя/Отчество идут подряд, берем последние до 3 строк.
          const picked = finalizeFio(beforeAnchor.slice(-3).join(" ").trim());
          if (picked.split(/\s+/).length >= 2) return picked;
        }
      }

      const surname =
        stripFioLabelNoise(
          pickSegmentByLabels(
            /(фамили[яи]?|тег[iі]|тегі)/i,
            /(аты|имя|отчеств|әкес|туған|дата|жсн|иин|$)/i
          )
        ) || stripFioLabelNoise(findByLabel(/(фамили|тегi|тегі)/i));
      const name =
        stripFioLabelNoise(
          pickSegmentByLabels(
            /(аты|имя)/i,
            /(отчеств|әкес|туған|дата|жсн|иин|$)/i
          )
        ) || stripFioLabelNoise(findByLabel(/(^имя\b|^аты\b)/i));
      const patronymic =
        stripFioLabelNoise(
          pickSegmentByLabels(
            /(отчеств|әкес[іi]н[іi]ң\s*аты|әкесінің\s*аты|әкесинин\s*аты)/i,
            /(туған|дата|жсн|иин|$)/i
          )
        ) ||
        stripFioLabelNoise(
          findByLabel(/(отчеств|әкес[іi]н[іi]ң аты|әкес[іi]н[іi] аты|әкесінің аты|әкесинин аты)/i)
        );
      const composed = finalizeFio([surname, name, patronymic].filter(Boolean).join(" ").trim());
      if (composed.split(/\s+/).filter(Boolean).length >= 2 && hasCyrillic(composed)) return composed;

      const candidates = lines
        .map((line) => sanitizeName(line))
        .map((line) => line.replace(/[.-]+/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .filter((line) => !/\d/.test(line))
        .filter((line) => {
          const low = line.toLowerCase();
          return !stopWords.some((word) => low.includes(word));
        })
        .filter((line) => looksLikePersonLine(line))
        .map((line) => {
          const parts = line.split(/\s+/).filter(Boolean);
          const upperScore = parts.reduce((acc, p) => acc + (p === p.toUpperCase() ? 1 : 0), 0);
          const score = upperScore * 2 + (parts.length === 3 ? 3 : 0);
          return { line, score };
        })
        .sort((a, b) => b.score - a.score);

      return finalizeFio(candidates[0]?.line || "");
    };

    if (field === "vin") {
      return extractVinStrict();
    }

    if (field === "iin") {
      return extractIinStrict();
    }

    if (field === "fio") {
      return extractFioStrict();
    }

    return clean;
  };

  const parseDocumentData = (rawText) => {
    const raw = String(rawText || "");
    return {
      fio: parseRecognizedTextByField("fio", raw),
      iin: parseRecognizedTextByField("iin", raw),
    };
  };

  const pickBestFioCandidate = (...values) => {
    const normalized = values
      .map((v) => String(v || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!normalized.length) return "";

    const isValidToken = (token) =>
      /^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]{2,}$/.test(token);

    const isNoise = (token) =>
      /^(аты|имя|отчество|әкесі|әкес[іi]н[іi]ң|екесінаты|әкесінің)$/i.test(token);

    const scored = normalized
      .map((value) => {
        const tokens = value.split(/\s+/).filter(Boolean);
        const validTokens = tokens.filter((t) => isValidToken(t) && !isNoise(t));
        const upperCount = validTokens.filter((t) => t === t.toUpperCase()).length;
        const score =
          validTokens.length * 4 +
          upperCount * 2 +
          (validTokens.length === 3 ? 3 : 0) -
          (tokens.length - validTokens.length) * 2;
        return { value: validTokens.slice(0, 3).join(" "), score };
      })
      .filter((x) => x.value.split(/\s+/).filter(Boolean).length >= 2)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.value || "";
  };

  const hardCleanFinalFio = (value) => {
    const cleaned = String(value || "")
      .replace(/\b(аты)\s+(имя)\b/gi, " ")
      .replace(/\b(тегі|тегi)\s+(фамили[яи]?)\b/gi, " ")
      .replace(/\b(әкес[іi]н[іi]ң)\s+(аты|отчество)\b/gi, " ")
      .replace(/\b(аты|имя|отчество|тегі|тегi|әкесі|әкесi|екесінаты|әкесінаты)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = cleaned
      .split(/\s+/)
      .filter(Boolean)
      .filter((part) => /^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]{2,}$/.test(part))
      .slice(0, 3);

    return tokens.join(" ").trim();
  };

  const cleanLowQualityPhotoFio = (value) => {
    const normalizeMixed = (token) =>
      String(token || "")
        .replace(/[Kk]/g, "К")
        .replace(/[Tt]/g, "Т")
        .replace(/[Aa]/g, "А")
        .replace(/[^А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]/g, "")
        .toUpperCase();

    const tokens = String(value || "")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length < 2) return String(value || "").trim();

    const isKtNoise = (token) => {
      const n = normalizeMixed(token);
      if (!n) return false;
      if (n === "КТ" || n === "КТА") return true;
      if (/^КТ+А?$/.test(n)) return true;
      return false;
    };

    const cleaned = tokens.filter((token, idx) => {
      const isMiddle = idx > 0 && idx < tokens.length - 1;
      if (isMiddle && isKtNoise(token)) return false;
      return true;
    });

    // Доп. очистка для склеек типа "КТАБАКЫТ" -> "БАКЫТ"
    const postProcessed = cleaned.map((token, idx) => {
      if (idx === 0) return token;
      const mixed = normalizeMixed(token);
      if (mixed.startsWith("КТА") && token.length > 4) {
        return token.slice(3);
      }
      if (mixed.startsWith("КТ") && token.length > 3) {
        return token.slice(2);
      }
      return token;
    });

    return postProcessed.join(" ").replace(/\s+/g, " ").trim();
  };

  const enrichFioWithPatronymic = (fioValue, rawText) => {
    const base = String(fioValue || "").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) return base;

    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) =>
        String(line || "")
          .replace(/[^А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ\s-]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    const patronymicPatterns = [
      /(ОВИЧ|ЕВИЧ|ИЧ|ОВНА|ЕВНА|ҚЫЗЫ|КЫЗЫ|ҰЛЫ|УЛЫ)$/i,
    ];

    const labelIdx = lines.findIndex((line) =>
      /(отчеств|әкес[іi]н[іi]ң\s*аты|әкесінің\s*аты|әкесинин\s*аты)/i.test(line)
    );

    const lineCandidates = [];
    if (labelIdx >= 0) {
      const same = lines[labelIdx]
        .replace(/(отчеств[оа]?|әкес[іi]н[іi]ң\s*аты|әкесінің\s*аты|әкесинин\s*аты)/gi, "")
        .trim();
      if (same) lineCandidates.push(same);
      if (lines[labelIdx + 1]) lineCandidates.push(lines[labelIdx + 1]);
    }

    lineCandidates.push(...lines);

    const patronymic = lineCandidates
      .map((line) => line.split(/\s+/).filter(Boolean))
      .flat()
      .find(
        (token) =>
          token.length >= 4 &&
          !parts.some((p) => p.toUpperCase() === token.toUpperCase()) &&
          patronymicPatterns.some((re) => re.test(token))
      );

    if (!patronymic) return base;
    return [...parts, patronymic].slice(0, 3).join(" ").trim();
  };

  const extractFioByIdAnchorFallback = (rawText) => {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    if (!lines.length) return "";

    const norm = (line) =>
      String(line || "")
        .replace(/[^А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const isNameLine = (line) => {
      const parts = norm(line).split(/\s+/).filter(Boolean);
      if (parts.length < 1 || parts.length > 3) return false;
      if (parts.some((p) => p.length < 2)) return false;
      if (parts.some((p) => /\d/.test(p))) return false;
      return parts.every((p) => /^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]+$/.test(p));
    };

    const anchorIdx = lines.findIndex((line) =>
      /(?:\b\d{2}[.\-/]\d{2}[.\-/]\d{4}\b|дата\s*рожд|туған\s*күні|\b\d{12}\b|иин|жсн)/i.test(line)
    );
    const start = anchorIdx > 0 ? Math.max(0, anchorIdx - 6) : 0;
    const end = anchorIdx > 0 ? anchorIdx : Math.min(lines.length, 12);
    const slice = lines.slice(start, end);

    const picked = [];
    for (const line of slice) {
      if (!isNameLine(line)) continue;
      const cleaned = norm(line);
      if (!cleaned) continue;
      const low = cleaned.toLowerCase();
      if (
        /(республика|удостоверение|министр|министерство|внутренних|істер|облыс|область|ұлты|националь)/i.test(
          low
        )
      ) {
        continue;
      }
      picked.push(cleaned);
    }

    if (!picked.length) return "";
    return picked.slice(0, 3).join(" ").trim();
  };

  const extractKazakhIdFioTriplet = (rawText) => {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    if (!lines.length) return "";

    const normalize = (line) =>
      String(line || "")
        .replace(/[^А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const isNameLike = (line) => {
      const parts = normalize(line).split(/\s+/).filter(Boolean);
      if (parts.length !== 1) return false;
      const p = parts[0];
      if (p.length < 2 || /\d/.test(p)) return false;
      if (!/^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]+$/.test(p)) return false;
      return true;
    };

    const anchorIdx = lines.findIndex((line) =>
      /(?:\b\d{2}[.\-/]\d{2}[.\-/]\d{4}\b|\b\d{12}\b|дата\s*рожд|туған\s*күні|иин|жсн)/i.test(line)
    );
    if (anchorIdx <= 0) return "";

    const upperWindow = lines.slice(Math.max(0, anchorIdx - 8), anchorIdx);
    const nameLines = upperWindow
      .map((line) => normalize(line))
      .filter((line) => isNameLike(line))
      .filter(
        (line) =>
          !/^(аты|имя|отчество|тегі|тегi|әкесі|әкесi|екесінаты|әкесінаты)$/i.test(line)
      );

    if (nameLines.length < 2) return "";
    return nameLines.slice(0, 3).join(" ").trim();
  };

  const attachAsUdostoverenie = (file) => {
    if (!file) return;
    setForm((prev) => ({
      ...prev,
      files: {
        ...(prev.files || {}),
        udostoverenie: [],
      },
    }));
    setFiles((prev) => ({ ...prev, udostoverenie: file }));
    setExistingFiles((prev) => prev.filter((item) => item.key !== "udostoverenie"));
    setFilesUploaded((prev) => [
      ...prev.filter((item) => item.key !== "udostoverenie"),
      {
        key: "udostoverenie",
        savedName: file.name,
        originalName: file.name,
        isExisting: false,
        index: 0,
      },
    ]);
  };

  const createOcrWorkerSafe = async () => {
    const { createWorker } = await import("tesseract.js");
    try {
      const worker = await createWorker("kaz+rus+eng");
      await worker.setParameters({ preserve_interword_spaces: "1" });
      return worker;
    } catch {
      const worker = await createWorker("rus+eng");
      await worker.setParameters({ preserve_interword_spaces: "1" });
      return worker;
    }
  };

  const extractPdfText = async (file) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
    const getDocumentFn = pdfjs?.getDocument || pdfjs?.default?.getDocument;
    const globalOptions =
      pdfjs?.GlobalWorkerOptions || pdfjs?.default?.GlobalWorkerOptions;
    if (!getDocumentFn) {
      throw new Error("PDF parser init failed");
    }
    if (globalOptions && !globalOptions.workerSrc) {
      globalOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }
    const data = await file.arrayBuffer();
    const doc = await getDocumentFn({ data }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((i) => i.str).join(" ");
    return text;
  };

  const renderPdfFirstPageCanvas = async (file) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
    const getDocumentFn = pdfjs?.getDocument || pdfjs?.default?.getDocument;
    const globalOptions =
      pdfjs?.GlobalWorkerOptions || pdfjs?.default?.GlobalWorkerOptions;
    if (!getDocumentFn) throw new Error("PDF parser init failed");
    if (globalOptions && !globalOptions.workerSrc) {
      globalOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }
    const data = await file.arrayBuffer();
    const doc = await getDocumentFn({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  };

  const cropFioAreaFromCanvas = (sourceCanvas) => {
    if (!sourceCanvas) return null;
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    if (!sw || !sh) return null;
    // Область ФИО в верхней части удостоверения (исключаем нижний блок с органом выдачи)
    const sx = Math.floor(sw * 0.34);
    const sy = Math.floor(sh * 0.10);
    const cw = Math.floor(sw * 0.52);
    const ch = Math.floor(sh * 0.30);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = cw;
    canvas.height = ch;
    ctx.drawImage(sourceCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
    return canvas;
  };

  const fileToRoiCanvas = async (file) => {
    if (!file?.type?.startsWith("image/")) return null;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sx = Math.floor(bitmap.width * 0.2);
    const sy = Math.floor(bitmap.height * 0.08);
    const sw = Math.floor(bitmap.width * 0.75);
    const sh = Math.floor(bitmap.height * 0.58);
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  };

  const fileToCanvas = async (file) => {
    if (!file?.type?.startsWith("image/")) return null;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
  };

  const scanDocumentAndAutofill = async (file) => {
    if (!file) return;
    try {
      setOcrLoading(true);
      attachAsUdostoverenie(file);

      let sourceText = "";
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");
      if (isPdf) {
        let pdfTextLayer = "";
        try {
          pdfTextLayer = await extractPdfText(file);
        } catch {
          pdfTextLayer = "";
        }
        const worker = await createOcrWorkerSafe();
        const pageCanvas = await renderPdfFirstPageCanvas(file);
        const {
          data: { text },
        } = await worker.recognize(pageCanvas);
        const fioCanvas = cropFioAreaFromCanvas(pageCanvas);
        let fioText = "";
        if (fioCanvas) {
          const roiResult = await worker.recognize(fioCanvas);
          fioText = roiResult?.data?.text || "";
        }
        sourceText = `${fioText}\n${text}\n${pdfTextLayer}`;
        setOcrDebug(`doc:pdf fio-roi=${fioText.length} full=${text.length} textlayer=${pdfTextLayer.length}`);

        const fioTripletFromLayer = extractKazakhIdFioTriplet(pdfTextLayer);
        const fioTripletFromFull = extractKazakhIdFioTriplet(text);
        const fioFromLayer = parseRecognizedTextByField("fio", pdfTextLayer);
        const fioFromFull = parseRecognizedTextByField("fio", text);
        const fioFromRoi = parseRecognizedTextByField("fio", fioText);
        const bestFio =
          pickBestFioCandidate(
            fioTripletFromLayer,
            fioTripletFromFull,
            fioFromLayer,
            fioFromFull,
            fioFromRoi
          ) || extractFioByIdAnchorFallback(`${pdfTextLayer}\n${text}`);
        const finalFio = hardCleanFinalFio(bestFio);

        const iinFromLayer = parseRecognizedTextByField("iin", pdfTextLayer);
        const iinFromFull = parseRecognizedTextByField("iin", text);
        const iinFromRoi = parseRecognizedTextByField("iin", `${fioText}\n${text}`);
        const bestIin = iinFromLayer || iinFromFull || iinFromRoi || "";

        setForm((prev) => ({
          ...prev,
          fio: finalFio || prev.fio || "",
          iin: bestIin || prev.iin || "",
        }));
        await worker.terminate();
        return;
      } else if (isImage) {
        const worker = await createOcrWorkerSafe();
        const {
          data: { text },
        } = await worker.recognize(file);
        const roiCanvas = await fileToRoiCanvas(file);
        const fullCanvas = await fileToCanvas(file);
        const fioCanvasFromImage = cropFioAreaFromCanvas(fullCanvas || null);
        let roiText = "";
        if (roiCanvas) {
          const roiResult = await worker.recognize(roiCanvas);
          roiText = roiResult?.data?.text || "";
        }
        let fioRoiText = "";
        if (fioCanvasFromImage) {
          const fioResult = await worker.recognize(fioCanvasFromImage);
          fioRoiText = fioResult?.data?.text || "";
        }
        sourceText = `${fioRoiText}\n${roiText}\n${text}`;
        setOcrDebug(`doc:image fio-roi=${fioRoiText.length} roi=${roiText.length} full=${text.length}`);

        const fioTripletFromFull = extractKazakhIdFioTriplet(text);
        const fioTripletFromRoi = extractKazakhIdFioTriplet(`${fioRoiText}\n${roiText}`);
        const fioFromFull = parseRecognizedTextByField("fio", text);
        const fioFromRoi = parseRecognizedTextByField("fio", `${fioRoiText}\n${roiText}`);
        const bestFio =
          pickBestFioCandidate(
            fioTripletFromFull,
            fioTripletFromRoi,
            fioFromFull,
            fioFromRoi
          ) || extractFioByIdAnchorFallback(`${fioRoiText}\n${roiText}\n${text}`);
        const finalFio = enrichFioWithPatronymic(
          cleanLowQualityPhotoFio(hardCleanFinalFio(bestFio)),
          `${fioRoiText}\n${roiText}\n${text}`
        );
        const bestIin = parseRecognizedTextByField("iin", `${roiText}\n${text}`) || "";
        setForm((prev) => ({
          ...prev,
          fio: finalFio || prev.fio || "",
          iin: bestIin || prev.iin || "",
        }));
        await worker.terminate();
        return;
      } else {
        alert("Файл сохранен в удостоверение, но OCR поддерживает только PDF/изображения.");
        return;
      }

      const parsed = parseDocumentData(sourceText);
      if (!parsed.fio && !parsed.iin) {
        alert("Не удалось выделить ФИО/ИИН из документа");
      }
      setForm((prev) => ({
        ...prev,
        fio: parsed.fio || prev.fio || "",
        iin: parsed.iin || prev.iin || "",
      }));
    } catch (err) {
      console.error("OCR DOCUMENT ERROR:", err);
      alert("Не удалось распознать документ. Файл сохранен в удостоверение, но OCR не прочитал поля.");
    } finally {
      setOcrLoading(false);
      if (ocrDocumentRef.current) ocrDocumentRef.current.value = "";
    }
  };

  const runOcrForFile = async (field, file) => {
    if (!field || !file) return;
    try {
      setOcrLoading(true);
      let sourceText = "";
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");
      if (isPdf) {
        let pdfTextLayer = "";
        try {
          pdfTextLayer = await extractPdfText(file);
        } catch {
          pdfTextLayer = "";
        }
        const worker = await createOcrWorkerSafe();
        const pageCanvas = await renderPdfFirstPageCanvas(file);
        const {
          data: { text },
        } = await worker.recognize(pageCanvas);
        let fioText = "";
        if (field === "fio") {
          const fioCanvas = cropFioAreaFromCanvas(pageCanvas);
          if (fioCanvas) {
            const fioResult = await worker.recognize(fioCanvas);
            fioText = fioResult?.data?.text || "";
          }
        }
        sourceText = `${fioText}\n${text}\n${pdfTextLayer}`;
        setOcrDebug(`field:${field} pdf fio-roi=${fioText.length} full=${text.length} textlayer=${pdfTextLayer.length}`);

        if (field === "fio") {
          const fioTripletFromLayer = extractKazakhIdFioTriplet(pdfTextLayer);
          const fioTripletFromFull = extractKazakhIdFioTriplet(text);
          const fioFromLayer = parseRecognizedTextByField("fio", pdfTextLayer);
          const fioFromFull = parseRecognizedTextByField("fio", text);
          const fioFromRoi = parseRecognizedTextByField("fio", fioText);
          const bestFio =
            pickBestFioCandidate(
              fioTripletFromLayer,
              fioTripletFromFull,
              fioFromLayer,
              fioFromFull,
              fioFromRoi
            ) ||
            extractFioByIdAnchorFallback(`${pdfTextLayer}\n${text}`);
          const finalFio = hardCleanFinalFio(bestFio);
          if (finalFio) {
            setForm((prev) => ({ ...prev, fio: finalFio }));
            await worker.terminate();
            return;
          }
        }
        await worker.terminate();
      } else if (isImage) {
        const worker = await createOcrWorkerSafe();
        const {
          data: { text },
        } = await worker.recognize(file);
        const roiCanvas = await fileToRoiCanvas(file);
        const fullCanvas = await fileToCanvas(file);
        const fioCanvasFromImage = field === "fio" ? cropFioAreaFromCanvas(fullCanvas || null) : null;
        let roiText = "";
        if (roiCanvas) {
          const roiResult = await worker.recognize(roiCanvas);
          roiText = roiResult?.data?.text || "";
        }
        let fioRoiText = "";
        if (fioCanvasFromImage) {
          const fioResult = await worker.recognize(fioCanvasFromImage);
          fioRoiText = fioResult?.data?.text || "";
        }
        await worker.terminate();
        sourceText = `${fioRoiText}\n${roiText}\n${text}`;
        setOcrDebug(`field:${field} image fio-roi=${fioRoiText.length} roi=${roiText.length} full=${text.length}`);

        if (field === "fio") {
          const fioTripletFromFull = extractKazakhIdFioTriplet(text);
          const fioTripletFromRoi = extractKazakhIdFioTriplet(`${fioRoiText}\n${roiText}`);
          const fioFromFull = parseRecognizedTextByField("fio", text);
          const fioFromRoi = parseRecognizedTextByField("fio", `${fioRoiText}\n${roiText}`);
          const bestFio =
            pickBestFioCandidate(
              fioTripletFromFull,
              fioTripletFromRoi,
              fioFromFull,
              fioFromRoi
            ) || extractFioByIdAnchorFallback(`${fioRoiText}\n${roiText}\n${text}`);
          const finalFio = enrichFioWithPatronymic(
            cleanLowQualityPhotoFio(hardCleanFinalFio(bestFio)),
            `${fioRoiText}\n${roiText}\n${text}`
          );
          if (finalFio) {
            setForm((prev) => ({ ...prev, fio: finalFio }));
            return;
          }
        }
      } else {
        alert("Этот тип файла не поддерживается. Выберите PDF или изображение.");
        return;
      }

      const parsed = parseRecognizedTextByField(field, sourceText);
      if (!parsed) {
        const fallback = parseDocumentData(sourceText)?.[field] || "";
        if (fallback) {
          setForm((prev) => ({
            ...prev,
            [field]:
              field === "fio"
                ? cleanLowQualityPhotoFio(hardCleanFinalFio(fallback))
                : fallback,
          }));
          return;
        }
        alert("Не удалось распознать поле. Попробуйте другой файл.");
        return;
      }
      const nextValue =
        field === "fio" ? cleanLowQualityPhotoFio(hardCleanFinalFio(parsed)) : parsed;
      setForm((prev) => ({
        ...prev,
        [field]: nextValue,
      }));
    } catch (err) {
      console.error("OCR ERROR:", err);
      alert("Ошибка OCR. Проверьте фото и попробуйте снова.");
    } finally {
      setOcrLoading(false);
      setOcrTarget("");
      if (ocrGalleryRef.current) ocrGalleryRef.current.value = "";
      if (ocrCameraRef.current) ocrCameraRef.current.value = "";
      if (ocrDocsRef.current) ocrDocsRef.current.value = "";
    }
  };

  const openOcrPicker = (field, source = "gallery") => {
    setOcrTarget(field);
    if (source === "documents") {
      ocrDocsRef.current?.click();
      return;
    }
    if (source === "camera") {
      ocrCameraRef.current?.click();
      return;
    }
    ocrGalleryRef.current?.click();
  };

  const appendFilesToFormData = (formDataToSend) => {
    Object.entries(files).forEach(([key, fileValue]) => {
      if (!fileValue) return;

      if (Array.isArray(fileValue)) {
        fileValue.forEach((file) => {
          if (file) formDataToSend.append(key, file);
        });
      } else {
        formDataToSend.append(key, fileValue);
      }
    });
  };

  const sendToWhatsapp = async () => {
    if (!form.phone) return alert("Укажите телефон!");

    const message = characteristics
      .map((c) => `${c.label}: ${form[c.key] || "-"}`)
      .join("\n");

    try {
      await axios.post(`${API_URL}/api/send-whatsapp`, {
        phone: form.phone,
        message,
      });
      alert("Сообщение отправлено!");
    } catch (err) {
      console.error(err);
      alert("Ошибка отправки в WhatsApp");
    }
  };

  const saveApplication = async () => {
    try {
      if (!id) {
        return await createNewApplication();
      }

      const formDataToSend = new FormData();
      const { _id, createdAt, updatedAt, ...safeForm } = form;
const log = createLogEntry({
  action: "Создание заявки",
  status: "На одобрении",
  startTime: window._startTime || Date.now(),
});
      formDataToSend.append(
        
        "form",
        
        JSON.stringify({
          ...safeForm,
          protocolNumber: normalizeProtocol(protocolNumber) || "",
          actorName: user?.login || user?.name || "unknown",
          sourcePage: "Создать заявку",
          characteristics: buildCharacteristics(safeForm),
          status1: safeForm.status1 || "На одобрении",
        })
      );
      formDataToSend.append("log", JSON.stringify(log));

      appendFilesToFormData(formDataToSend);

      await axios.put(`${API_URL}/api/applications/${id}`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Изменения сохранены");
    } catch (err) {
      console.error(err.response?.data || err);
      alert("Ошибка сохранения: " + (err.response?.data?.message || err.message));
    }
  };

  const createNewApplication = async () => {
    const startTime = window._startTime || Date.now();
  const duration = Date.now() - startTime;
  const durationMinutes = Math.max(0, Math.round(duration / 60000));

  const log = createLogEntry({
    action: "Создание заявки",
    status: "На одобрении",
    startTime,
    duration,
  });
    try {
      const formDataToSend = new FormData();
      const { _id, createdAt, updatedAt, ...safeForm } = form;

      formDataToSend.append(
        "form",
        JSON.stringify({
          ...safeForm,
          protocolNumber: normalizeProtocol(protocolNumber) || "",
          actorName: user?.login || user?.name || "unknown",
          sourcePage: "Создать заявку",
          createdBy: user?.login || user?.name || "unknown",
          creationDurationMinutes: durationMinutes,
          activityLogs: [
            {
              action: "create_application",
              by: user?.login || user?.name || "unknown",
              at: new Date().toISOString(),
              durationMinutes,
            },
          ],
          characteristics: buildCharacteristics(safeForm),
          status1: safeForm.status1 || "На одобрении",
        })
      );
      formDataToSend.append("log", JSON.stringify(log));

      appendFilesToFormData(formDataToSend);

      const res = await axios.post(
        `${API_URL}/api/applications/save`,
        formDataToSend,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      alert("Новая заявка создана");

      const newId = res.data?._id;
      if (newId) {
        navigate(`/applications/${newId}`);
      }
    } catch (err) {
      console.error(err.response?.data || err);
      alert("Ошибка создания: " + (err.response?.data?.message || err.message));
    }
  };

  const handleCreateZayavka = async () => {
    try {
      if (!zayavkaNumber) return alert("Введите номер заявки");
      if (!zayavkaDate) return alert("Введите дату заявки");

      const filteredCharacteristics = characteristics.filter(
        (item) => !["fio", "iin", "address", "type"].includes(item.key)
      );

      const zayavkaData = {
        applicationId: id || null,
        zayavkaNumber,
        zayavkaDate,
        brand: form.brand || "",
        model: form.model || "",
        vin: form.vin || "",
        year: form.year || "",
        typ: form.typ || "",
        category: form.category || "",
        manufacturer: form.MANUFACTURER || "",
        fio: form.fio || "",
        address: form.address || "",
        iin: form.iin || "",
        characteristics: filteredCharacteristics.map((item) => ({
          key: item.key || "",
          label: item.label || "",
          value: form[item.key] || item.value || "",
        })),
      };

      const res = await axios.post(`${API_URL}/api/zayavki/create`, zayavkaData);

      const zayavkaId = res.data._id;
      alert("Заявка сформирована");

      window.open(`${API_URL}/api/zayavki/${zayavkaId}/pdf`, "_blank");
      setShowZayavkaModal(false);
    } catch (err) {
      console.error(err);
      alert("Ошибка создания заявки");
    }
  };

  const handleCreateDogovor = async () => {
    try {
      if (!dogovorNumber) return alert("Введите номер");
      if (!dogovorDate) return alert("Введите дату");

      const dogovorData = {
        applicationId: id || null,
        dogovorNumber,
        dogovorDate,
        fio: form.fio || "",
        address: form.address || "",
        iin: form.iin || "",
      };

      const res = await axios.post(`${API_URL}/api/dogovors/create`, dogovorData);
      const dogovorId = res.data._id;

      alert("Договор создан");
      window.open(`${API_URL}/api/dogovors/${dogovorId}/pdf-template`, "_blank");
      setShowDogovorModal(false);
    } catch (err) {
      console.error(err);
      alert("Ошибка создания договора");
    }
  };

  const handleCreateDecision = async () => {
    try {
      if (!decisionNumber) return alert("Введите номер решения");
      if (!decisionDate) return alert("Введите дату решения");

      const decisionData = {
        applicationId: id || null,
        decisionNumber,
        decisionDate,
        brand: form.brand || "",
        model: form.model || "",
        vin: form.vin || "",
        year: form.year || "",
        typ: form.typ || "",
        category: form.category || "",
      };

      const res = await axios.post(`${API_URL}/api/decisions/create`, decisionData);
      const decisionId = res.data._id;

      alert("Решение создано");
      window.open(`${API_URL}/api/decisions/${decisionId}/pdf-template`, "_blank");
      setShowDecisionModal(false);
    } catch (err) {
      console.error(err);
      alert("Ошибка создания решения");
    }
  };

  const handleCreateProtocol = async () => {
    try {
      const realCategory = form.category;
      const templateCategory =
        form.templateCategory || getTemplateCategory(form.category);
      const finalFuelType = isN3Category(templateCategory)
        ? "Дизель"
        : form.fuelType;

      if (!templateCategory) return alert("Выберите категорию");

      if (!isOCategory(templateCategory) && !finalFuelType) {
        return alert("Выберите тип топлива");
      }

      if (isN3Category(templateCategory) && !form.n3Type) {
        return alert("Выберите тип N3: седельный или грузовой");
      }

      if (!protocolNumber) return alert("Введите номер");
      if (!protocolDate) return alert("Введите дату");

      let weather = { temp: "", humidity: "", pressure: "" };

      try {
        const w = await axios.get(`${API_URL}/api/weather`, {
          params: { city: "Almaty", date: protocolDate },
        });

        weather = {
          temp: String(w.data.temp ?? ""),
          humidity: String(w.data.humidity ?? ""),
          pressure: String(w.data.pressure ?? ""),
        };
      } catch (e) {
        console.warn("Weather API fail, fallback to manual");
      }

      const protocolData = {
        applicationId: id || null,
        category: realCategory,
        templateCategory,
        fuelType: finalFuelType,
        n3Type: String(form.n3Type || "").trim().toLowerCase(),
        protocolNumber,
        protocolDate,
        brand: form.brand || "",
        model: form.model || "",
        typ: form.typ || "",
        vin: form.vin || "",
        EcologicalClass: form.EcologicalClass || "",
        year: form.year || "",
        fio: form.fio || "",
        MANUFACTURER: form.MANUFACTURER || "",
        legaladdressoftheMANUFACTURER: form.legaladdressoftheMANUFACTURER || "",
        ASSEMBLYPLANT: form.ASSEMBLYPLANT || "",
        addressoftheassemblyplant: form.addressoftheassemblyplant || "",
        address: form.address || "",
        extraEquipment: form.extraEquipment || "",
        length: form.length || "",
        width: form.width || "",
        height: form.height ?? form.Height ?? "",
        coMin: coMin || "",
        coMax: coMax || "",
        noiseValue: noiseValue || "",
        smokeValue: smokeValue || "",
        temperature: String(temperature ?? "").trim() || weather.temp,
        humidity: String(humidity ?? "").trim() || weather.humidity,
        pressure: String(pressure ?? "").trim() || weather.pressure,
      };

      const res = await axios.post(`${API_URL}/api/protocols/create`, protocolData);
      const protocolId = res.data._id;

      alert("Протокол создан!");
      window.open(`${API_URL}/api/protocols/${protocolId}/pdf-template`, "_blank");
      setShowProtocolModal(false);
    } catch (err) {
      console.error(err);
      alert("Ошибка создания протокола");
    }
  };

  const generateApplicationPdf = async () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      await loadRoboto(doc);
doc.setFont("Roboto", "normal");

      const pageWidth = doc.internal.pageSize.getWidth();
      const left = 15;
      const right = 15;
      const contentWidth = pageWidth - left - right;

      let y = 15;

      const applicationNumber = id ? String(id).slice(-6) : "-";
      const applicationDate = form.createdAt || new Date().toISOString().split("T")[0];

      doc.setFont("Roboto", "bold");
      doc.setFontSize(14);
      doc.text(`ЗАЯВКА № ${applicationNumber}`, pageWidth / 2, y, {
        align: "center",
      });

      y += 7;

      doc.setFont("Roboto", "normal");
      doc.setFontSize(11);
      doc.text(formatDateRu(applicationDate), pageWidth / 2, y, {
        align: "center",
      });

      y += 10;

      doc.setFont("Roboto", "bold");
      doc.setFontSize(11);
      doc.text(
        "На проведение работ по оценке соответствия транспортного средства",
        left,
        y
      );
      y += 6;
      doc.text("требованиям ТР ТС 018/2011 в форме СБКТС", left, y);

      y += 10;

      const topRows = [
        ["Модель автомобиля", form.model || "-"],
        ["Идентификационный номер (VIN)", form.vin || "-"],
        ["Название изготовителя", form.MANUFACTURER || "-"],
        ["Ф.И.О. заявителя", form.fio || "-"],
        ["Адрес заявителя", form.address || "-"],
        ["ИИН", form.iin || "-"],
      ];

      autoTable(doc, {
        startY: y,
        theme: "grid",
        body: topRows,
        styles: {
          font: "Roboto",
          fontSize: 10,
          cellPadding: 3,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          overflow: "linebreak",
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 68, fontStyle: "bold" },
          1: { cellWidth: contentWidth - 68 },
        },
        margin: { left, right },
      });

      y = doc.lastAutoTable.finalY + 8;

      doc.setFont("Roboto", "bold");
      doc.setFontSize(13);
      doc.text(
        "ОБЩИЕ ХАРАКТЕРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА",
        pageWidth / 2,
        y,
        { align: "center" }
      );

      y += 6;

      const filteredCharacteristics = characteristics.filter(
        (item) => !["fio", "iin", "address"].includes(item.key)
      );

      const tableData = filteredCharacteristics.map((item) => [
        item.label || "",
        String(form[item.key] || item.value || "-"),
      ]);

      autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["Параметр", "Значение"]],
        body: tableData,
        showHead: "firstPage",
        rowPageBreak: "avoid",
        styles: {
          font: "Roboto",
          fontSize: 10,
          cellPadding: 3,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          font: "Roboto",
          fontStyle: "bold",
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 100 },
        },
        margin: { top: 20, left, right, bottom: 15 },
      });

      doc.save(`zayavka_${form.vin || "no_vin"}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Ошибка генерации заявки");
    }
  };

  const generatePDF = async () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");

      await loadRoboto(doc);
doc.setFont("Roboto", "normal");

      doc.setFontSize(16);
      doc.text("ОБЩИЕ ХАРАКТИРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА", 105, 15, {
        align: "center",
      });

      const tableData = characteristics.map((item) => [
        item.label || "",
        String(form[item.key] || "-"),
      ]);

    autoTable(doc, {
  startY: 25,
  theme: "grid",
  head: [["Параметр", "Значение"]],
  body: tableData,
  showHead: "firstPage",
  rowPageBreak: "avoid",

  styles: {
    font: "Roboto",
    fontSize: 10,
    cellPadding: 4,
    lineColor: [0, 0, 0],
    lineWidth: 0.25,
    textColor: [0, 0, 0],
    overflow: "linebreak",
    valign: "top",
    minCellHeight: 8,
  },

  headStyles: {
    font: "Roboto",
    fontStyle: "bold",
    fillColor: [220, 235, 255], // голубой
    textColor: [0, 0, 0],
  },

  columnStyles: {
    0: { cellWidth: 72 },
    1: { cellWidth: 108 },
  },

  margin: { top: 20, left: 15, right: 15, bottom: 15 },
});

      doc.save(`${form.fio || "application"}_${form.vin || "no_vin"}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Ошибка PDF — смотри console");
    }
  };

  const existingDocsByKey = {};
  docFieldConfigs.forEach((item) => {
    existingDocsByKey[item.key] = [];
  });

  existingFiles.forEach((file) => {
    if (file.key !== "photos" && existingDocsByKey[file.key]) {
      existingDocsByKey[file.key].push(file);
    }
  });

  const uploadedDocsByKey = {};
  docFieldConfigs.forEach((item) => {
    uploadedDocsByKey[item.key] = [];
  });

  filesUploaded.forEach((file) => {
    if (file.key !== "photos" && uploadedDocsByKey[file.key]) {
      uploadedDocsByKey[file.key].push(file);
    }
  });

  const existingPhotos = existingFiles.filter(
    (file) => file.key === "photos" || isImageName(file.originalName)
  );

  const uploadedPhotos = filesUploaded.filter(
    (file) => file.key === "photos" || isImageName(file.originalName)
  );

  const isIinValid = /^\d{12}$/.test(form.iin || "");

  return (
    <div className="app-form">
       <TimerTracker
      onStart={(t) => {
        window._startTime = t;
      }}
    />
      <div className="left">
        <h2>Исходные данные</h2>
        <button
          type="button"
          className="scan-document-btn"
          onClick={() => ocrDocumentRef.current?.click()}
        >
          Сканировать документ (ФИО + ИИН) и прикрепить в удостоверение
        </button>
        {!ocrLoading && ocrDebug ? (
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              marginTop: 4,
              marginBottom: 6,
              border: "1px dashed #cbd5e1",
              borderRadius: 8,
              padding: "4px 8px",
              background: "#f8fafc",
            }}
          >
            OCR debug: {ocrDebug}
          </div>
        ) : null}
        <div className="scan-field-row">
          <input name="fio" placeholder="ФИО" value={form.fio} onChange={handleChange} />
          <button type="button" className="scan-icon-btn" title="Из фотопленки/камеры" onClick={() => openOcrPicker("fio", "gallery")}>🖼</button>
          <button type="button" className="scan-icon-btn" title="Из документов (PDF/файл)" onClick={() => openOcrPicker("fio", "documents")}>📄</button>
        </div>
        <input
  name="iin"
  placeholder="ИИН"
  value={form.iin}
  onChange={(e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 12);
    setForm((prev) => ({ ...prev, iin: value }));
  }}
  style={{
    border: form.iin && !isIinValid ? "2px solid red" : "",
    backgroundColor: form.iin && !isIinValid ? "#fff5f5" : "",
  }}
/>
<div className="scan-inline-actions">
  <button type="button" className="scan-icon-btn" title="ИИН из фотопленки/камеры" onClick={() => openOcrPicker("iin", "gallery")}>🖼</button>
  <button type="button" className="scan-icon-btn" title="ИИН из документов (PDF/файл)" onClick={() => openOcrPicker("iin", "documents")}>📄</button>
</div>
{form.iin && !isIinValid && (
  <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
    ИИН должен содержать ровно 12 цифр
  </div>
)}
        <input name="address" placeholder="Адрес" value={form.address} onChange={handleChange} />
        <div style={{ display: "flex", alignItems: "center" }}>
          <input name="phone" placeholder="Телефон" value={form.phone} onChange={handleChange} />
          <button className="whatsapp-btn" onClick={sendToWhatsapp}>Отправить WhatsApp</button>
        </div>
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <div className="scan-field-row">
          <input name="vin" placeholder="VIN" value={form.vin} onChange={handleChange} />
          <button type="button" className="scan-icon-btn" title="VIN из фотопленки/камеры" onClick={() => openOcrPicker("vin", "gallery")}>🖼</button>
          <button type="button" className="scan-icon-btn" title="VIN из документов (PDF/файл)" onClick={() => openOcrPicker("vin", "documents")}>📄</button>
        </div>

        <select name="status1" value={form.status1 || ""} onChange={handleChange}>
          <option value="">Статус</option>
          <option value="На одобрении">На одобрении</option>
          <option value="Одобрено">Одобрено</option>
          <option value="Выполняется">Выполняется</option>
          <option value="Ждем прозвона">Ждем прозвона</option>
          <option value="Прозвон есть">Прозвон есть</option>
          <option value="Ждем фото">Ждем фото</option>
          <option value="Фото есть">Фото есть</option>
          <option value="Выпущено">Выпущено</option>
          <option value="Стоп">Стоп</option>
        </select>

        <input name="broker" placeholder="Брокер" value={form.broker} onChange={handleChange} />
        <input name="createdAt" type="date" value={form.createdAt} onChange={handleChange} />

        <div style={{ fontSize: 12, color: "#475569", marginTop: 2, marginBottom: 4 }}>
          Найдено машин: {carsByFuel.length}
        </div>

        <select name="fuelType" value={form.fuelType || ""} onChange={handleChange}>
          <option value="">Выберите топливо</option>
          {fuelOptions.map((fuel) => (
            <option key={fuel} value={fuel}>
              {fuel}
            </option>
          ))}
        </select>

        <select name="type" value={form.type} onChange={handleChange}>
          <option value="">Выберите тип автомобиля</option>
          {typeOptions.map((t, i) => (
            <option key={i} value={t}>{t}</option>
          ))}
        </select>

        <select name="brand" value={form.brand} onChange={handleChange}>
          <option value="">Выберите марку</option>
          {brandOptionGroups.map((group) => (
            <optgroup key={group.letter} label={group.letter}>
              {group.values.map((value) => (
                <option key={`${group.letter}-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          name="model"
          value={form.model}
          onChange={handleChange}
          disabled={!form.brand}
        >
          <option value="">
            {!form.brand ? "Сначала выберите марку" : "Выберите модель"}
          </option>
          {modelOptions.map((m, i) => (
            <option key={i} value={m}>{m}</option>
          ))}
        </select>

        <select
          name="year"
          value={form.year}
          onChange={handleChange}
          disabled={!form.brand || !form.model}
        >
          <option value="">
            {!form.brand
              ? "Сначала выберите марку"
              : !form.model
                ? "Сначала выберите модель"
                : "Выберите год"}
          </option>
          {yearOptions.map((y, i) => (
            <option key={i} value={y}>{y}</option>
          ))}
        </select>

        <select
          name="volume"
          value={form.volume}
          onChange={handleChange}
          disabled={!form.year}
        >
          <option value="">
            {!form.year ? "Сначала выберите год" : "Выберите объём"}
          </option>
          {volumeOptions.map((v, i) => (
            <option key={i} value={v}>{v}</option>
          ))}
        </select>

        <div className="left-section">
          <h3 className="left-section-title">Документы</h3>
          <div className="left-section-subtitle">Загрузите файлы заявки</div>

          {docFieldConfigs.map((item) => (
            <div key={item.key} style={{ marginBottom: "14px" }}>
              <label>{item.label}:</label>
              <input
                type="file"
                onChange={(e) => handleFileChange(e, item.key)}
              />

              {existingDocsByKey[item.key]?.length > 0 && (
                <div style={{ marginTop: "6px", paddingLeft: "4px" }}>
                  {existingDocsByKey[item.key].map((file) => (
                    <div key={`${file.key}-${file.index}`}>
                      {file.savedName ? (
                        <a
                          href={`${API_URL}/uploads/${file.savedName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {file.originalName}
                        </a>
                      ) : (
                        <span>{file.originalName}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploadedDocsByKey[item.key]?.length > 0 && (
                <div style={{ marginTop: "6px", paddingLeft: "4px" }}>
                  {uploadedDocsByKey[item.key].map((file, index) => (
                    <div key={`${file.key}-new-${index}`}>
                      {file.originalName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="left-section" style={{ marginTop: "18px" }}>
          <h3 className="left-section-title">Фотографии</h3>
          <div className="left-section-subtitle">Фото авто и связанных документов</div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileChange(e, "photos")}
          />

          {existingPhotos.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              {existingPhotos.map((file) => (
                <div key={`photo-old-${file.index}`}>
                  {file.savedName ? (
                    <a
                      href={`${API_URL}/uploads/${file.savedName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {file.originalName}
                    </a>
                  ) : (
                    <span>{file.originalName}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {uploadedPhotos.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              {uploadedPhotos.map((file, index) => (
                <div key={`photo-new-${index}`}>
                  {file.originalName}
                </div>
              ))}
            </div>
          )}
        </div>
        <input
          ref={ocrGalleryRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => runOcrForFile(ocrTarget, e.target.files?.[0])}
        />
        <input
          ref={ocrDocsRef}
          type="file"
          accept=".pdf,image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => runOcrForFile(ocrTarget, e.target.files?.[0])}
        />
        <input
          ref={ocrCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => runOcrForFile(ocrTarget, e.target.files?.[0])}
        />
        <input
          ref={ocrDocumentRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => scanDocumentAndAutofill(e.target.files?.[0])}
        />
        {ocrLoading ? <div style={{ fontSize: 12, color: "#0f172a" }}>Распознавание текста...</div> : null}
        
      </div>

      <div className="right">
        <div className="protocol-number-box">
          <label>№ протокола</label>
          <input
            value={protocolNumber}
            onChange={(e) => setProtocolNumber(normalizeProtocol(e.target.value))}
            placeholder="0566"
          />
        </div>
        <h2>ОБЩИЕ ХАРАКТИРИСТИКИ ТРАНСПОРТНОГО СРЕДСТВА</h2>
        <div className="characteristics-table full-width-table">
          {characteristics.map((item, index) => (
            <div className="table-row" key={index}>
              <div className="table-cell label">{item.label}</div>
              <div className="table-cell value">
                <textarea
                  value={item.value || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [item.key]: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>

        <button className="back-btn" onClick={() => navigate(-1)}>
          Назад
        </button>

        <div className="pdf-buttons">
          <button className="pdf-btn" onClick={createNewApplication}>
            Создать заявку
          </button>

          <button className="pdf-btn" onClick={generatePDF}>
            Сформировать МАКЕТ
          </button>

          <button className="pdf-btn" onClick={() => setShowProtocolModal(true)}>
            Сформировать ПРОТОКОЛ
          </button>

          {showProtocolModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Создание протокола</h3>

                <div className="form-group">
                  <label>Категория</label>
                  <select
                    name="templateCategory"
                    value={form.templateCategory}
                    onChange={handleChange}
                  >
                    <option value="">Выберите категорию</option>
                    <option value="M1">M1</option>
                    <option value="M2">M2</option>
                    <option value="M3">M3</option>
                    <option value="N1">N1</option>
                    <option value="N2">N2</option>
                    <option value="N3">N3</option>
                    <option value="O1">O1</option>
                    <option value="O2">O2</option>
                    <option value="O3">O3</option>
                    <option value="O4">O4</option>
                  </select>
                </div>

                {needsFuelSelect(form.templateCategory) && (
                  <div className="form-group">
                    <label>Тип топлива</label>
                    <select
                      name="fuelType"
                      value={form.fuelType}
                      onChange={handleChange}
                    >
                      <option value="">Выберите топливо</option>
                      <option value="Бензин">Бензин</option>
                      <option value="Дизель">Дизель</option>
                      <option value="Электро">Электро</option>
                    </select>
                  </div>
                )}

                {isN3Category(form.templateCategory) && (
                  <>
                    <div className="form-group">
                      <label>Тип топлива</label>
                      <select
                        name="fuelType"
                        value="Дизель"
                        onChange={handleChange}
                        disabled
                      >
                        <option value="Дизель">Дизель</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Тип N3</label>
                      <select
                        name="n3Type"
                        value={form.n3Type}
                        onChange={handleChange}
                      >
                        <option value="">Выберите тип</option>
                        <option value="sedelnyi">Седельный</option>
                        <option value="gruzovoi">Грузовой</option>
                      </select>
                    </div>
                  </>
                )}

                {!isOCategory(form.templateCategory) && (
                  <div className="form-group">
                    <label>Экологический класс</label>
                    <input
                      type="text"
                      name="EcologicalClass"
                      value={form.EcologicalClass}
                      onChange={handleChange}
                    />
                  </div>
                )}

                <label>Номер протокола</label>
                <input
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                />

                <label>Дата протокола</label>
                <input
                  type="date"
                  value={protocolDate}
                  onChange={(e) => setProtocolDate(e.target.value)}
                />

                {isBenzin && (
                  <>
                    <label>CO (min)</label>
                    <input value={coMin} onChange={(e) => setCoMin(e.target.value)} />

                    <label>CO (max)</label>
                    <input value={coMax} onChange={(e) => setCoMax(e.target.value)} />

                    <label>Шум</label>
                    <input
                      value={noiseValue}
                      onChange={(e) => setNoiseValue(e.target.value)}
                    />
                  </>
                )}

                {isDiesel && (
                  <>
                    <label>Дым</label>
                    <input
                      value={smokeValue}
                      onChange={(e) => setSmokeValue(e.target.value)}
                    />

                    <label>Шум</label>
                    <input
                      value={noiseValue}
                      onChange={(e) => setNoiseValue(e.target.value)}
                    />
                  </>
                )}

                <label>Температура (°C)</label>
                <input
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />

                <label>Влажность (%)</label>
                <input
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                />

                <label>Давление (мм рт. ст.)</label>
                <input
                  value={pressure}
                  onChange={(e) => setPressure(e.target.value)}
                />

                <button
                  className="btn btn-gray"
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await axios.get(`${API_URL}/api/weather`, {
                        params: { city: "Almaty", date: protocolDate },
                      });

                      setTemperature(res.data.temp || "");
                      setHumidity(res.data.humidity || "");
                      setPressure(res.data.pressure || "");
                    } catch (e) {
                      alert("Не удалось получить погоду");
                    }
                  }}
                >
                  Подтянуть из интернета
                </button>

                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-blue" onClick={handleCreateProtocol}>
                    Создать
                  </button>

                  <button
                    className="btn btn-red"
                    onClick={() => setShowProtocolModal(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <button className="pdf-btn" onClick={() => setShowZayavkaModal(true)}>
            Сформировать заявку
          </button>

          {showZayavkaModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Создание заявки</h3>

                <label>Номер заявки</label>
                <input
                  value={zayavkaNumber}
                  onChange={(e) => setZayavkaNumber(e.target.value)}
                />

                <label>Дата заявки</label>
                <input
                  type="date"
                  value={zayavkaDate}
                  onChange={(e) => setZayavkaDate(e.target.value)}
                />

                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-blue" onClick={handleCreateZayavka}>
                    Создать
                  </button>

                  <button
                    className="btn btn-red"
                    onClick={() => setShowZayavkaModal(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <button className="pdf-btn" onClick={() => setShowDecisionModal(true)}>
            Сформировать решение
          </button>

          {showDecisionModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Создание решения</h3>

                <label>Номер решения</label>
                <input
                  value={decisionNumber}
                  onChange={(e) => setDecisionNumber(e.target.value)}
                />

                <label>Дата решения</label>
                <input
                  type="date"
                  value={decisionDate}
                  onChange={(e) => setDecisionDate(e.target.value)}
                />

                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-blue" onClick={handleCreateDecision}>
                    Создать
                  </button>

                  <button
                    className="btn btn-red"
                    onClick={() => setShowDecisionModal(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <button className="pdf-btn" onClick={() => setShowDogovorModal(true)}>
            Сформировать договор
          </button>

          {showDogovorModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Создание договора</h3>

                <label>Номер договора</label>
                <input
                  value={dogovorNumber}
                  onChange={(e) => setDogovorNumber(e.target.value)}
                />

                <label>Дата договора</label>
                <input
                  type="date"
                  value={dogovorDate}
                  onChange={(e) => setDogovorDate(e.target.value)}
                />

                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-blue" onClick={handleCreateDogovor}>
                    Создать
                  </button>

                  <button
                    className="btn btn-red"
                    onClick={() => setShowDogovorModal(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <button className="pdf-btn">Сформировать тех запись</button>

          {id && (
            <button className="pdf-btn" onClick={saveApplication}>
              Сохранить изменения
            </button>
          )}
        </div>
      </div>
    </div>
  );
}