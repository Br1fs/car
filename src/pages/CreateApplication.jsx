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
import { formatGenerationYearSpan } from "../utils/generationYears.js";

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
const normalizeVinValue = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[ОО]/g, "0")
    .replace(/[І]/g, "1")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
const isVinValid = (value) => /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVinValue(value));
const getVinCheckDigit = (vin) => {
  const valueMap = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const chars = String(vin || "").toUpperCase().split("");
  if (chars.length !== 17) return "";

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const ch = chars[i];
    const num = /\d/.test(ch) ? Number(ch) : valueMap[ch];
    if (num === undefined) return "";
    sum += num * weights[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
};
const isVinChecksumValid = (vin) => {
  const normalized = normalizeVinValue(vin);
  if (!isVinValid(normalized)) return false;
  const expected = getVinCheckDigit(normalized);
  if (!expected) return false;
  return normalized[8] === expected;
};
const withMutedTesseractParamWarnings = async (work) => {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const first = String(args?.[0] || "");
    if (first.includes("Parameter not found:")) return;
    originalWarn(...args);
  };
  try {
    return await work();
  } finally {
    console.warn = originalWarn;
  }
};
const FIO_NOISE_REGEX =
  /(республик|удостовер|жеке|кулiк|куәлік|личности|министр|министер|внутренних|дел|орган|выдан|берген|дата|рожд|туған|күні|identity|card|ioctob|iostob|akeke|kyoj|kylik)/i;
const isPlausibleFioValue = (value) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (FIO_NOISE_REGEX.test(text)) return false;
  if (/\d/.test(text)) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 3) return false;
  return tokens.every((token) => /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]{2,}$/.test(token));
};
const scoreVinCandidate = (vin) => {
  const normalized = normalizeVinValue(vin);
  if (normalized.length !== 17) return -999;
  if (!isVinValid(normalized)) return -999;
  const checksumOk = isVinChecksumValid(normalized);
  const wmiPrefixes = [
    "4T1", "JTD", "JT2", "JT3", "JT4", "5TD", "2T1",
    "LS4", "LSG", "LSV", "LFV", "LGB", "LFP", "LZW",
  ];
  let score = 0;
  if (checksumOk) score += 20;
  if (/^\d/.test(normalized)) score += 2;
  if (/[A-Z]/.test(normalized) && /\d/.test(normalized)) score += 2;
  if (wmiPrefixes.some((prefix) => normalized.startsWith(prefix))) score += 8;
  const digitCount = (normalized.match(/\d/g) || []).length;
  if (digitCount >= 6 && digitCount <= 11) score += 4;
  else score -= 4;
  if (/(.)\1\1/.test(normalized)) score -= 6;
  return score;
};
const pickBestVinValue = (values = []) => {
  const unique = [...new Set(values.map((v) => normalizeVinValue(v)).filter(Boolean))];
  if (!unique.length) return "";
  const ranked = unique
    .map((value) => ({ value, score: scoreVinCandidate(value), checksum: isVinChecksumValid(value) }))
    .sort((a, b) => b.score - a.score);
  const checksumPool = ranked.filter((item) => item.checksum);
  return (checksumPool[0] || ranked[0] || {}).value || "";
};

const fuelOptions = ["Бензин", "Дизель", "Электро"];
const buildExtraEquipmentText = ({ iccid = "", imei = "" } = {}) =>
  `Оснащен устройством вызова экстренных оперативных служб: FALCON 004901 ICCID: ${iccid}, IMEI: ${imei}
Сертификат Соответствия RU С-RU.ЭМ03.В.00168/24, срок действия с 02.12.2024 по 01.12.2028, подписан Репина Д.А.`;

const normalizeFuelLabel = (value) => {
  const fuel = String(value || "").trim().toLowerCase().replace("ё", "е");
  if (!fuel) return "";
  if (fuel.includes("диз")) return "Дизель";
  if (fuel.includes("бенз") || fuel.includes("газ") || fuel.includes("lpg") || fuel.includes("gpl")) return "Бензин";
  if (fuel.includes("элект")) return "Электро";
  return "";
};

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

/** Текст и флаги для карточки «поколение» (как на Kolesa). */
const buildGenerationCardDisplay = (car) => {
  const yf = car.generationYearFrom ?? car.year;
  const yt = car.generationYearTo ?? car.year;
  const yearsLine = formatGenerationYearSpan(yf, yt, car.year);
  const chassis = String(car.generationChassis || car.chassis || "").trim();
  const facelift =
    car.generationFacelift === true ||
    String(car.generationFacelift || "")
      .toLowerCase()
      .includes("рестайл") ||
    String(car.generationFacelift || "").toLowerCase() === "да";
  return { yearsLine, chassis, facelift };
};

const resolveCarGenerationImage = (raw, apiBase) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${apiBase}${s}`;
  return `${apiBase}/uploads/${s}`;
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
  const [carSelection, setCarSelection] = useState({
    type: "",
    brand: "",
    model: "",
    year: "",
    volume: "",
    pickCarId: "",
  });
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
  const ocrTargetRef = useRef("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDebug, setOcrDebug] = useState("");
  const [ocrFieldDebug, setOcrFieldDebug] = useState({});
  const ocrDocumentRef = useRef(null);
  const vinCandidatesDebugRef = useRef("");

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
  const nextSel = {
    type: selectedCar.type || "",
    brand: selectedCar.brand || "",
    model: selectedCar.model || "",
    year: selectedCar.year ? String(selectedCar.year) : "",
    volume: selectedCar.volume != null && selectedCar.volume !== "" ? String(selectedCar.volume) : "",
    pickCarId: "",
  };
  const matchCopy = cars.find((car) => {
    if (!isEqualLoose(car.type, nextSel.type)) return false;
    if (!isEqualLoose(car.brand, nextSel.brand)) return false;
    if (!isEqualLoose(car.model, nextSel.model)) return false;
    if (nextSel.year && !isEqualLoose(car.year, nextSel.year)) return false;
    if (nextSel.volume !== "" && !isEqualLoose(car.volume, nextSel.volume)) return false;
    return true;
  });
  if (matchCopy?._id) nextSel.pickCarId = String(matchCopy._id);
  setCarSelection(nextSel);
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
        const sel = {
          type: data.type || "",
          brand: data.brand || "",
          model: data.model || "",
          year: data.year ? String(data.year) : "",
          volume: data.volume != null && data.volume !== "" ? String(data.volume) : "",
          pickCarId: "",
        };
        setCarSelection(sel);
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

  useEffect(() => {
    if (!id || !cars.length) return;
    setCarSelection((prev) => {
      if (!prev.type || !prev.brand || !prev.model || prev.pickCarId) return prev;
      const m = cars.find((car) => {
        if (!isEqualLoose(car.type, prev.type)) return false;
        if (!isEqualLoose(car.brand, prev.brand)) return false;
        if (!isEqualLoose(car.model, prev.model)) return false;
        if (prev.year && !isEqualLoose(car.year, prev.year)) return false;
        if (prev.volume !== "" && prev.volume != null && !isEqualLoose(car.volume, prev.volume)) return false;
        return true;
      });
      if (!m?._id) return prev;
      return { ...prev, pickCarId: String(m._id) };
    });
  }, [id, cars]);

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
            .filter((c) => !carSelection.type || c.type === carSelection.type)
            .map((c) => c.brand)
            .filter(Boolean)
        ),
      ]),
    [carsByFuel, carSelection.type]
  );
  const brandOptionGroups = useMemo(() => groupByFirstLetter(brandOptions), [brandOptions]);

  const modelOptions = useMemo(
    () =>
      sortAlpha([
        ...new Set(
          carsByFuel
            .filter(
              (c) =>
                (!carSelection.type || c.type === carSelection.type) &&
                (!carSelection.brand || c.brand === carSelection.brand)
            )
            .map((c) => c.model)
            .filter(Boolean)
        ),
      ]),
    [carsByFuel, carSelection.type, carSelection.brand]
  );

  const generationCandidates = useMemo(() => {
    if (!carSelection.type || !carSelection.brand || !carSelection.model) return [];
    return carsByFuel
      .filter(
        (c) =>
          c.type === carSelection.type &&
          c.brand === carSelection.brand &&
          c.model === carSelection.model
      )
      .sort((a, b) => {
        const ay = Number(a.generationYearFrom ?? a.year) || 0;
        const by = Number(b.generationYearFrom ?? b.year) || 0;
        if (ay !== by) return ay - by;
        const av = Number(String(a.volume ?? "").replace(",", ".")) || 0;
        const bv = Number(String(b.volume ?? "").replace(",", ".")) || 0;
        return av - bv;
      });
  }, [carsByFuel, carSelection.type, carSelection.brand, carSelection.model]);

  const selectedGenerationSummary = useMemo(() => {
    if (!carSelection.pickCarId) return "";
    const c = generationCandidates.find((x) => String(x._id) === String(carSelection.pickCarId));
    if (!c) return "";
    const d = buildGenerationCardDisplay(c);
    const label = String(c.generationLabel || "").trim();
    return label || [d.yearsLine, d.chassis].filter(Boolean).join(" · ");
  }, [generationCandidates, carSelection.pickCarId]);

  useEffect(() => {
    if (!cars.length) return;
    if (!carSelection.type || !carSelection.brand || !carSelection.model) return;

    const matched = cars.find((car) => {
      if (!isEqualLoose(car.type, carSelection.type)) return false;
      if (!isEqualLoose(car.brand, carSelection.brand)) return false;
      if (!isEqualLoose(car.model, carSelection.model)) return false;

      if (carSelection.pickCarId) return String(car._id) === String(carSelection.pickCarId);
      const hasYear = String(carSelection.year ?? "").trim() !== "";
      const hasVol = String(carSelection.volume ?? "").trim() !== "";
      if (!hasYear && !hasVol) return false;
      if (hasYear && !isEqualLoose(car.year, carSelection.year)) return false;
      if (hasVol && !isEqualLoose(car.volume, carSelection.volume)) return false;
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
        type: carSelection.type,
        brand: carSelection.brand,
        model: carSelection.model,
        year: carSelection.year || String(matched.year ?? ""),
        volume: carSelection.volume || String(matched.volume ?? ""),
      };

      const changed = Object.keys(next).some((key) => String(next[key] ?? "") !== String(prev[key] ?? ""));
      return changed ? next : prev;
    });
  }, [
    cars,
    carSelection.type,
    carSelection.brand,
    carSelection.model,
    carSelection.year,
    carSelection.volume,
    carSelection.pickCarId,
  ]);

  const handleCarSelectionChange = (e) => {
    const { name, value } = e.target;

    setCarSelection((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "type") {
        next.brand = "";
        next.model = "";
        next.year = "";
        next.volume = "";
        next.pickCarId = "";
      }
      if (name === "brand") {
        next.model = "";
        next.year = "";
        next.volume = "";
        next.pickCarId = "";
      }
      if (name === "model") {
        next.year = "";
        next.volume = "";
        next.pickCarId = "";
      }
      if (name === "year") {
        next.volume = "";
        next.pickCarId = "";
      }

      return next;
    });

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };
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

  const pickGenerationCar = (car) => {
    if (!car?._id) return;
    setCarSelection((prev) => ({
      ...prev,
      year: car.year != null && car.year !== "" ? String(car.year) : "",
      volume: car.volume != null && car.volume !== "" ? String(car.volume) : "",
      pickCarId: String(car._id),
    }));
  };

  const handleFuelTypeSelectionChange = (e) => {
    const value = e.target.value;

    setCarSelection({
      type: "",
      brand: "",
      model: "",
      year: "",
      volume: "",
      pickCarId: "",
    });

    setForm((prev) => ({
      ...prev,
      fuelType: value,
      type: "",
      brand: "",
      model: "",
      year: "",
      volume: "",
    }));
  };

  const handleProtocolFieldChange = (e) => {
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

      return next;
    });
  };

  const openProtocolModal = () => {
    setForm((prev) => {
      let nextTemplateCategory = prev.templateCategory || getTemplateCategory(prev.category);
      let nextFuelType = prev.fuelType || normalizeFuelLabel(prev.fuel);

      if (isN3Category(nextTemplateCategory)) {
        nextFuelType = "Дизель";
      }
      if (isOCategory(nextTemplateCategory)) {
        nextFuelType = "";
      }

      const changed =
        String(nextTemplateCategory || "") !== String(prev.templateCategory || "") ||
        String(nextFuelType || "") !== String(prev.fuelType || "");

      if (!changed) return prev;

      return {
        ...prev,
        templateCategory: nextTemplateCategory || "",
        fuelType: nextFuelType || "",
      };
    });
    setShowProtocolModal(true);
  };

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
    const primaryFile = selectedFiles[0];

    setFiles((prev) => {
      if (key === "photos") {
        return {
          ...prev,
          [key]: [...(prev[key] || []), ...selectedFiles],
        };
      }

      return {
        ...prev,
        [key]: primaryFile,
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
          savedName: primaryFile.name,
          originalName: primaryFile.name,
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

    if (key === "actDoc") {
      void autofillExtraEquipmentFromAct(primaryFile);
    }
  };

  const extractActEquipmentValues = (rawText) => {
    const compact = String(rawText || "")
      .replace(/\u00A0/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .trim();
    if (!compact) return { iccid: "", imei: "" };

    const digitsOnly = compact.replace(/\D/g, " ");
    const imeiByLabel = compact.match(/IMEI\s*[:\-]?\s*([\d\s-]{14,20})/i)?.[1] || "";
    const iccidByLabel = compact.match(/ICCID\s*[:\-]?\s*([\d\s-]{18,25})/i)?.[1] || "";

    const imei =
      imeiByLabel.replace(/\D/g, "").slice(0, 15) ||
      (digitsOnly.match(/\b\d{15}\b/) || [])[0] ||
      "";
    const iccid =
      iccidByLabel.replace(/\D/g, "").slice(0, 20) ||
      (digitsOnly.match(/\b89\d{18}\b/) || [])[0] ||
      (digitsOnly.match(/\b\d{20}\b/) || [])[0] ||
      "";

    return { iccid, imei };
  };

  const autofillExtraEquipmentFromAct = async (file) => {
    if (!file) return;
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = String(file.type || "").startsWith("image/");
      let sourceText = "";

      if (isPdf) {
        let textLayer = "";
        try {
          textLayer = await extractPdfText(file);
        } catch {
          textLayer = "";
        }
        sourceText = textLayer;
        if (!textLayer.trim()) {
          const worker = await createOcrWorkerSafe();
          const pageCanvas = await renderPdfFirstPageCanvas(file);
          const result = await worker.recognize(pageCanvas);
          sourceText = result?.data?.text || "";
          await worker.terminate();
        }
      } else if (isImage) {
        const worker = await createOcrWorkerSafe();
        const result = await worker.recognize(file);
        sourceText = result?.data?.text || "";
        await worker.terminate();
      } else {
        return;
      }

      const { iccid, imei } = extractActEquipmentValues(sourceText);
      if (!iccid && !imei) return;

      setForm((prev) => ({
        ...prev,
        extraEquipment: buildExtraEquipmentText({
          iccid: iccid || "",
          imei: imei || "",
        }),
      }));
    } catch (err) {
      console.error("ACT PARSE ERROR:", err);
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
      vinCandidatesDebugRef.current = "";
      const normalizeVinText = (value) =>
        String(value || "")
          .toUpperCase()
          // Безопасные OCR-замены: только очевидные "похожие" символы.
          .replace(/[О]/g, "0")
          .replace(/[І]/g, "1")
          .replace(/[|]/g, "1")
          .replace(/[^A-Z0-9]/g, " ");

      const noiseVinHints = [
        "PSI",
        "KPA",
        "COLD",
        "TIRE",
        "TYRE",
        "FRONT",
        "REAR",
        "SEAT",
        "SEATS",
        "RIMS",
        "CAPACITY",
        "LOADING",
      ];

      const isNoisyVinCandidate = (value) => {
        const text = String(value || "").toUpperCase();
        if (!text) return true;
        return noiseVinHints.some((hint) => text.includes(hint));
      };

      const vinRe = /[A-HJ-NPR-Z0-9]{17}/g;
      const candidates = [];
      const wmiPrefixes = [
        "4T1", "JTD", "JT2", "JT3", "JT4", "5TD", "2T1",
        "LS4", "LSG", "LSV", "LFV", "LGB", "LFP", "LZW",
      ];
      const pushCandidate = (value, score) => {
        const normalized = normalizeVinValue(value);
        if (normalized.length !== 17) return;
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) return;
        if (isNoisyVinCandidate(normalized)) return;
        const hasLetters = /[A-Z]/.test(normalized);
        const hasDigits = /\d/.test(normalized);
        const startsWithDigit = /^\d/.test(normalized);
        const wmiLooksReal = /^[A-HJ-NPR-Z0-9]{3}/.test(normalized);
        const checksumOk = isVinChecksumValid(normalized);
        const bonus =
          (hasLetters && hasDigits ? 2 : 0) +
          (startsWithDigit ? 2 : 0) +
          (wmiLooksReal ? 1 : 0) +
          (checksumOk ? 12 : -8);
        candidates.push({ value: normalized, score: score + bonus, checksumOk });

        // OCR часто теряет первый символ VIN и добавляет мусор в конце.
        // Пробуем восстановить WMI: S4... -> LS4..., T1... -> 4T1... и т.п.
        for (const wmi of wmiPrefixes) {
          const tail = wmi.slice(1);
          if (!normalized.startsWith(tail)) continue;
          const repaired = normalizeVinValue(`${wmi[0]}${normalized.slice(0, 16)}`);
          if (repaired.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(repaired)) continue;
          const repairedChecksum = isVinChecksumValid(repaired);
          const repairedBonus = (repairedChecksum ? 10 : -3) + 6;
          candidates.push({
            value: repaired,
            score: score + bonus + repairedBonus,
            checksumOk: repairedChecksum,
          });
        }
      };

      // 1) Приоритет: строки, где явно есть VIN
      const vinByLabel = findByLabel(/vin/i);
      const labelNormalized = normalizeVinText(vinByLabel);
      const labelMatches = labelNormalized.match(vinRe) || [];
      labelMatches.forEach((match) => pushCandidate(match, 100));

      for (let i = 0; i < lines.length; i += 1) {
        if (!/\bvin\b/i.test(lines[i])) continue;
        const area = [lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(" ");
        const lineMatches = normalizeVinText(area).match(vinRe) || [];
        lineMatches.forEach((match) => pushCandidate(match, 90));
      }

      // 2) По всему тексту: собираем все кандидаты
      const allNormalized = normalizeVinText(raw);
      const directMatches = allNormalized.match(vinRe) || [];
      directMatches.forEach((match) => pushCandidate(match, 40));

      // 3) Если OCR разбил VIN на куски — склеиваем токены
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
            const mergedMatches = merged.match(vinRe) || [];
            mergedMatches.forEach((match) => pushCandidate(match, 30));
          }
        }
      }

      if (candidates.length) {
        const ranked = [...candidates]
          .map((item) => ({
            ...item,
            quality: scoreVinCandidate(item.value),
            finalScore: item.score + scoreVinCandidate(item.value),
          }))
          .sort((a, b) => b.finalScore - a.finalScore);
        vinCandidatesDebugRef.current = ranked
          .slice(0, 5)
          .map(
            (item, idx) =>
              `${idx + 1}) ${item.value} | score=${item.finalScore} (raw=${item.score}, q=${item.quality}) | checksum=${item.checksumOk ? "ok" : "bad"}`
          )
          .join(" ; ");
        const validChecksumCandidates = ranked.filter((item) => item.checksumOk);
        const pool = validChecksumCandidates.length ? validChecksumCandidates : ranked;
        return pool[0].value;
      }

      // 4) Очень шумный случай — fallback без фильтров по шуму
      const compact = allNormalized.replace(/\s+/g, "");
      const fallback = compact.match(/[A-HJ-NPR-Z0-9]{17}/g) || [];
      if (fallback.length) {
        vinCandidatesDebugRef.current = `fallback: ${fallback.slice(0, 3).join(", ")}`;
      }
      return normalizeVinValue(fallback[0] || "");
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
      .filter((part) => /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]{2,}$/.test(part))
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
  const enrichFioWithPatronymicLoose = (fioValue, rawText) => {
    const base = String(fioValue || "").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) return base;

    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => String(line || "").replace(/[^A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ\s-]/g, " "))
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const patronymicLike = (token) =>
      /(OVICH|EVICH|ICH|OVNA|EVNA|VNA|KYZY|KIZY|ULY|ULI|ОВИЧ|ЕВИЧ|ИЧ|ОВНА|ЕВНА|ҚЫЗЫ|КЫЗЫ|ҰЛЫ|УЛЫ)$/i.test(
        String(token || "")
      );
    const normalizeLeetToken = (token) =>
      String(token || "")
        .toUpperCase()
        .replace(/4/g, "Ч")
        .replace(/3/g, "З")
        .replace(/0/g, "О")
        .replace(/6/g, "Б")
        .replace(/8/g, "В")
        .replace(/X/g, "Х")
        .replace(/A/g, "А")
        .replace(/B/g, "В")
        .replace(/E/g, "Е")
        .replace(/K/g, "К")
        .replace(/M/g, "М")
        .replace(/H/g, "Н")
        .replace(/O/g, "О")
        .replace(/P/g, "Р")
        .replace(/C/g, "С")
        .replace(/T/g, "Т")
        .replace(/Y/g, "У");

    const fromTokens = lines
      .flatMap((line) => line.split(/\s+/).filter(Boolean))
      .find((token) => {
        const normalizedToken = normalizeLeetToken(token);
        if (!patronymicLike(token) && !patronymicLike(normalizedToken)) return false;
        return !parts.some((p) => p.toUpperCase() === token.toUpperCase());
      });

    if (!fromTokens) return base;
    const normalizedPatronymic = normalizeLeetToken(fromTokens);
    return [...parts, normalizedPatronymic || fromTokens].slice(0, 3).join(" ").trim();
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
  const extractFioLooseFallback = (rawText) => {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) =>
        String(line || "")
          .replace(/[.,;:_/\\()[\]{}]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
    if (!lines.length) return "";

    const stopWords = [
      "республика", "удостоверение", "личности", "дата", "рождения", "орган", "выдан",
      "номер", "vin", "иин", "жсн", "министр", "министерство", "внутренних", "дел",
      "область", "облысы", "национальность", "место", "туған", "күні", "паспорт",
      "identity", "card", "issued", "birth", "date", "kyhi", "kyni", "tyfah", "tugan",
    ];
    const noisyLineRegex =
      /(республик|казахстан|қазақстан|respubl|republic|kazakh|qazaq|kaakctah|pect|peci|pech|yeji|hkacei|yejiutka|туған\s*күні|дата\s*рожд|tyfah\s*kyhi|tugan\s*kuni)/i;

    const normalizeToken = (token) =>
      String(token || "")
        .replace(/[^A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]/g, "")
        .trim();

    const isNameToken = (token) => {
      if (!token || token.length < 2) return false;
      if (/\d/.test(token)) return false;
      return /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]+$/.test(token);
    };

    const candidates = lines
      .map((line) => {
        const lower = line.toLowerCase();
        if (stopWords.some((w) => lower.includes(w))) return null;
        if (noisyLineRegex.test(line)) return null;
        const tokens = line
          .split(/\s+/)
          .map(normalizeToken)
          .filter(isNameToken);
        if (tokens.length < 2 || tokens.length > 4) return null;
        const nonLabelTokens = tokens.filter(
          (t) => !/^(туған|күні|дата|рождени[ея]|kyhi|kyni|tyfah|tugan|iata|data)$/i.test(t)
        );
        if (nonLabelTokens.length < 2) return null;
        const joined = tokens.join(" ");
        if (noisyLineRegex.test(joined)) return null;
        const upperCount = tokens.filter((t) => t === t.toUpperCase()).length;
        const cyrCount = tokens.filter((t) => /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ]/.test(t)).length;
        const longTokenPenalty = tokens.some((t) => t.length > 14) ? -4 : 0;
        const score = tokens.length * 3 + upperCount * 2 + cyrCount * 2 + longTokenPenalty;
        return { value: tokens.slice(0, 3).join(" "), score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.value || "";
  };
  const extractFioFromMrz = (rawText) => {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    const mrzLine = lines.find((line) => /[A-Z]{2,}<<[A-Z]{2,}/.test(line.toUpperCase()));
    if (!mrzLine) return "";
    const cleaned = mrzLine
      .toUpperCase()
      .replace(/[^A-Z<]/g, "")
      .replace(/<+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const tokens = cleaned.split(" ").filter((t) => t.length >= 2);
    if (tokens.length < 2) return "";
    const candidate = tokens.slice(0, 3).join(" ");
    return candidate;
  };
  const chooseFioByMode = ({ mode, rawText, roiText = "", layerText = "" }) => {
    if (mode === "pdf") {
      const best =
        pickBestFioCandidate(
          extractKazakhIdFioTriplet(layerText),
          extractKazakhIdFioTriplet(rawText),
          parseRecognizedTextByField("fio", layerText),
          parseRecognizedTextByField("fio", rawText),
          parseRecognizedTextByField("fio", roiText)
        ) ||
        extractFioByIdAnchorFallback(`${layerText}\n${rawText}`) ||
        extractFioLooseFallback(`${roiText}\n${layerText}\n${rawText}`);
      return hardCleanFinalFio(best);
    }

    if (mode === "photo_bad") {
      const mrz = extractFioFromMrz(`${roiText}\n${rawText}`);
      const strict = parseRecognizedTextByField("fio", `${roiText}\n${rawText}`);
      const loose = extractFioLooseFallback(`${roiText}\n${rawText}`);
      const best = pickBestFioCandidate(mrz, strict, loose);
      return enrichFioWithPatronymicLoose(
        cleanLowQualityPhotoFio(hardCleanFinalFio(best)),
        `${roiText}\n${rawText}`
      );
    }

    const strict = parseRecognizedTextByField("fio", `${roiText}\n${rawText}`);
    const triplet = extractKazakhIdFioTriplet(`${roiText}\n${rawText}`);
    const best = pickBestFioCandidate(strict, triplet, extractFioByIdAnchorFallback(`${roiText}\n${rawText}`));
    return enrichFioWithPatronymic(
      cleanLowQualityPhotoFio(hardCleanFinalFio(best)),
      `${roiText}\n${rawText}`
    );
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
      const worker = await withMutedTesseractParamWarnings(() => createWorker("kaz+rus+eng"));
      await withMutedTesseractParamWarnings(() =>
        worker.setParameters({ preserve_interword_spaces: "1" })
      );
      return worker;
    } catch {
      const worker = await withMutedTesseractParamWarnings(() => createWorker("rus+eng"));
      await withMutedTesseractParamWarnings(() =>
        worker.setParameters({ preserve_interword_spaces: "1" })
      );
      return worker;
    }
  };
  const createVinWorkerSafe = async () => {
    const { createWorker } = await import("tesseract.js");
    try {
      const worker = await withMutedTesseractParamWarnings(() => createWorker("eng"));
      await withMutedTesseractParamWarnings(() =>
        worker.setParameters({
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: "6",
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        })
      );
      return worker;
    } catch {
      const worker = await withMutedTesseractParamWarnings(() => createWorker("eng"));
      await withMutedTesseractParamWarnings(() =>
        worker.setParameters({ preserve_interword_spaces: "1" })
      );
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
    const rawItems = (content.items || [])
      .map((item) => {
        const y = Number(item?.transform?.[5] ?? 0);
        const x = Number(item?.transform?.[4] ?? 0);
        const str = String(item?.str || "").trim();
        if (!str) return null;
        return { x, y, str };
      })
      .filter(Boolean);

    rawItems.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 1.5) return b.y - a.y; // сверху вниз
      return a.x - b.x; // слева направо
    });

    const lines = [];
    for (const item of rawItems) {
      const prev = lines[lines.length - 1];
      if (!prev || Math.abs(prev.y - item.y) > 1.5) {
        lines.push({ y: item.y, parts: [item.str] });
      } else {
        prev.parts.push(item.str);
      }
    }

    const text = lines
      .map((line) => line.parts.join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
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

  const rotateCanvas = (sourceCanvas, angleDeg) => {
    if (!sourceCanvas) return null;
    const normalized = ((angleDeg % 360) + 360) % 360;
    if (normalized === 0) return sourceCanvas;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    if (normalized === 90 || normalized === 270) {
      canvas.width = sh;
      canvas.height = sw;
    } else {
      canvas.width = sw;
      canvas.height = sh;
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normalized * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -sw / 2, -sh / 2);
    return canvas;
  };
  const cropCanvasRect = (sourceCanvas, x, y, w, h) => {
    if (!sourceCanvas) return null;
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    if (!sw || !sh) return null;
    const sx = Math.max(0, Math.min(sw - 1, Math.floor(x)));
    const sy = Math.max(0, Math.min(sh - 1, Math.floor(y)));
    const cw = Math.max(1, Math.min(sw - sx, Math.floor(w)));
    const ch = Math.max(1, Math.min(sh - sy, Math.floor(h)));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = cw;
    canvas.height = ch;
    ctx.drawImage(sourceCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
    return canvas;
  };
  const buildVinFocusedCanvases = (fullCanvas) => {
    if (!fullCanvas) return [];
    const sw = fullCanvas.width;
    const sh = fullCanvas.height;
    // Несколько зон VIN-плашки: центр, правый блок, верхний центральный блок.
    const centerWide = cropCanvasRect(fullCanvas, sw * 0.12, sh * 0.20, sw * 0.78, sh * 0.46);
    const rightTall = cropCanvasRect(fullCanvas, sw * 0.48, sh * 0.08, sw * 0.48, sh * 0.84);
    const topBand = cropCanvasRect(fullCanvas, sw * 0.10, sh * 0.08, sw * 0.82, sh * 0.34);
    return [fullCanvas, centerWide, rightTall, topBand].filter(Boolean);
  };
  const buildMrzFocusedCanvas = (fullCanvas) => {
    if (!fullCanvas) return null;
    const sw = fullCanvas.width;
    const sh = fullCanvas.height;
    // MRZ обычно в нижней части удостоверения
    return cropCanvasRect(fullCanvas, sw * 0.08, sh * 0.68, sw * 0.84, sh * 0.25);
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
      setOcrFieldDebug((prev) => ({
        ...prev,
        [field]: `start: ${file.name} (${file.type || "unknown"})`,
      }));
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
        setOcrFieldDebug((prev) => ({
          ...prev,
          [field]: `pdf: fio-roi=${fioText.length}, full=${text.length}, textLayer=${pdfTextLayer.length}`,
        }));

        if (field === "fio") {
          const finalFio = chooseFioByMode({
            mode: "pdf",
            rawText: text,
            roiText: fioText,
            layerText: pdfTextLayer,
          });
          if (finalFio && isPlausibleFioValue(finalFio)) {
            setOcrFieldDebug((prev) => ({
              ...prev,
              fio: `${prev.fio || ""} -> mode:pdf parsed: ${String(finalFio).slice(0, 48)}`,
            }));
            setForm((prev) => ({ ...prev, fio: finalFio }));
            await worker.terminate();
            return;
          }
        }
        await worker.terminate();
      } else if (isImage) {
        const worker = field === "vin" ? await createVinWorkerSafe() : await createOcrWorkerSafe();
        const roiCanvas = await fileToRoiCanvas(file);
        const fullCanvas = await fileToCanvas(file);
        const {
          data: { text },
        } = await worker.recognize(file);

        let roiText = "";
        let fioRoiText = "";

        if (field === "vin") {
          const focusCanvases = buildVinFocusedCanvases(fullCanvas);
          const vinCanvases = [];
          focusCanvases.forEach((base) => {
            vinCanvases.push(base);
            const rotated90 = rotateCanvas(base, 90);
            const rotated270 = rotateCanvas(base, 270);
            if (rotated90) vinCanvases.push(rotated90);
            if (rotated270) vinCanvases.push(rotated270);
          });
          const vinTexts = [];
          const vinParsedAttempts = [];
          for (const c of vinCanvases) {
            const vinRes = await worker.recognize(c);
            const rawVinText = vinRes?.data?.text || "";
            vinTexts.push(rawVinText);
            const parsedAttempt = parseRecognizedTextByField("vin", rawVinText);
            vinParsedAttempts.push({
              parsed: parsedAttempt,
              candidates: vinCandidatesDebugRef.current || "",
            });
          }
          sourceText = `${vinTexts.join("\n")}\n${text}`;
          const parsedByAttempt = vinParsedAttempts.map((x) => x.parsed);
          const bestVin = pickBestVinValue([...parsedByAttempt, parseRecognizedTextByField("vin", text)]);
          const bestAttempt = vinParsedAttempts.find((x) => normalizeVinValue(x.parsed) === normalizeVinValue(bestVin));
          setOcrDebug(
            `field:vin image full=${text.length} tries=${vinTexts.length} best=${bestVin || "-"}`
          );
          setOcrFieldDebug((prev) => ({
            ...prev,
            vin: `image: full=${text.length}, tries=${vinTexts.length} -> parsed: ${bestVin || "-"} | candidates: ${bestAttempt?.candidates || vinCandidatesDebugRef.current || "none"}`,
          }));
          await worker.terminate();
          if (bestVin) {
            setForm((prev) => ({ ...prev, vin: bestVin }));
            return;
          }
        } else {
          const fioCanvasFromImage = field === "fio" ? cropFioAreaFromCanvas(fullCanvas || null) : null;
          if (roiCanvas) {
            const roiResult = await worker.recognize(roiCanvas);
            roiText = roiResult?.data?.text || "";
          }
          if (fioCanvasFromImage) {
            const fioResult = await worker.recognize(fioCanvasFromImage);
            fioRoiText = fioResult?.data?.text || "";
          }
          sourceText = `${fioRoiText}\n${roiText}\n${text}`;
          setOcrDebug(`field:${field} image fio-roi=${fioRoiText.length} roi=${roiText.length} full=${text.length}`);
          setOcrFieldDebug((prev) => ({
            ...prev,
            [field]: `image: fio-roi=${fioRoiText.length}, roi=${roiText.length}, full=${text.length}`,
          }));
        }
        if (field === "fio") {
          const fullConfidence = Number(text ? 65 : 0);
          const roiConfidence = Number(roiText ? 60 : 0);
          const mode = fullConfidence < 60 || roiConfidence < 55 ? "photo_bad" : "photo_good";
          const finalFio = chooseFioByMode({
            mode,
            rawText: text,
            roiText: `${fioRoiText}\n${roiText}`,
          });
          if (finalFio && isPlausibleFioValue(finalFio)) {
            setOcrFieldDebug((prev) => ({
              ...prev,
              fio: `${prev.fio || ""} -> mode:${mode} parsed: ${String(finalFio).slice(0, 48)}`,
            }));
            setForm((prev) => ({ ...prev, fio: finalFio }));
            return;
          }

          // Аварийный fallback: отдельный OCR зоны MRZ внизу фото
          const mrzCanvas = buildMrzFocusedCanvas(fullCanvas || null);
          let mrzText = "";
          if (mrzCanvas) {
            const mrzRes = await worker.recognize(mrzCanvas);
            mrzText = mrzRes?.data?.text || "";
          }
          const mrzCandidate = hardCleanFinalFio(extractFioFromMrz(`${mrzText}\n${text}\n${roiText}`));
          if (mrzCandidate) {
            setOcrFieldDebug((prev) => ({
              ...prev,
              fio: `${prev.fio || ""} -> mode:mrz_fallback parsed: ${String(mrzCandidate).slice(0, 48)}`,
            }));
            setForm((prev) => ({ ...prev, fio: mrzCandidate }));
            return;
          }

          setOcrFieldDebug((prev) => ({
            ...prev,
            fio: `${prev.fio || ""} -> no parsed (filtered as noise)`,
          }));
        }
        await worker.terminate();
      } else {
        alert("Этот тип файла не поддерживается. Выберите PDF или изображение.");
        return;
      }

      const parsed = parseRecognizedTextByField(field, sourceText);
      if (!parsed) {
        if (field === "fio") {
          const looseFio = hardCleanFinalFio(extractFioLooseFallback(sourceText));
          if (looseFio) {
            setOcrFieldDebug((prev) => ({
              ...prev,
              fio: `${prev.fio || ""} -> fallback: ${String(looseFio).slice(0, 48)}`,
            }));
            setForm((prev) => ({
              ...prev,
              fio: looseFio,
            }));
            return;
          }
        }
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
        field === "fio"
          ? cleanLowQualityPhotoFio(hardCleanFinalFio(parsed))
          : field === "vin"
            ? normalizeVinValue(parsed)
            : parsed;
      setOcrFieldDebug((prev) => ({
        ...prev,
        [field]:
          field === "vin"
            ? `${prev[field] || ""} -> parsed: ${String(nextValue || "").slice(0, 48)} | candidates: ${vinCandidatesDebugRef.current || "none"}`
            : `${prev[field] || ""} -> parsed: ${String(nextValue || "").slice(0, 48)}`,
      }));
      setForm((prev) => ({
        ...prev,
        [field]: nextValue,
      }));
    } catch (err) {
      console.error("OCR ERROR:", err);
      setOcrFieldDebug((prev) => ({
        ...prev,
        [ocrTargetRef.current || ocrTarget || "unknown"]: `error: ${String(err?.message || err).slice(0, 140)}`,
      }));
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
    ocrTargetRef.current = field;
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
      const { data } = await axios.post(`${API_URL}/api/applications/send-whatsapp`, {
        phone: form.phone,
        message,
      });
      if (data?.via === "link" && data?.waUrl) {
        window.open(data.waUrl, "_blank", "noopener,noreferrer");
      }
      alert(data?.message || "Готово");
    } catch (err) {
      console.error(err);
      const waUrl = err.response?.data?.waUrl;
      if (waUrl) {
        window.open(waUrl, "_blank", "noopener,noreferrer");
      }
      alert(
        err.response?.data?.message ||
          "Ошибка отправки в WhatsApp. Проверьте номер и настройки API."
      );
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
  const vinNormalized = normalizeVinValue(form.vin || "");
  const vinHasValue = vinNormalized.length > 0;
  const vinLooksValid = isVinValid(vinNormalized);

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
        {!ocrLoading && ocrFieldDebug.fio ? (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: -2, marginBottom: 6 }}>
            OCR fio: {ocrFieldDebug.fio}
          </div>
        ) : null}
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
{!ocrLoading && ocrFieldDebug.iin ? (
  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", marginBottom: "6px" }}>
    OCR iin: {ocrFieldDebug.iin}
  </div>
) : null}
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
          <input
            name="vin"
            placeholder="VIN"
            value={form.vin}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                vin: normalizeVinValue(e.target.value),
              }))
            }
            style={{
              border: vinHasValue && !vinLooksValid ? "2px solid red" : "",
              backgroundColor: vinHasValue && !vinLooksValid ? "#fff5f5" : "",
            }}
          />
          <button type="button" className="scan-icon-btn" title="VIN из фотопленки/камеры" onClick={() => openOcrPicker("vin", "gallery")}>🖼</button>
          <button type="button" className="scan-icon-btn" title="VIN из документов (PDF/файл)" onClick={() => openOcrPicker("vin", "documents")}>📄</button>
        </div>
        {!ocrLoading && ocrFieldDebug.vin ? (
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "-2px", marginBottom: "6px" }}>
            OCR vin: {ocrFieldDebug.vin}
          </div>
        ) : null}
        {vinHasValue && !vinLooksValid && (
          <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
            VIN должен содержать ровно 17 символов и не включать I, O, Q
          </div>
        )}

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
          В базе по топливу: {carsByFuel.length}
          {carSelection.model
            ? ` · вариантов поколения: ${generationCandidates.length}`
            : ""}
        </div>

        <div className="car-picker-kolesa">
          <div className="car-picker-block">
            <div className="car-picker-row-label">Топливо</div>
            <div className="car-picker-chips" role="group" aria-label="Топливо">
              <button
                type="button"
                className={`car-picker-chip ${form.fuelType === "" ? "car-picker-chip-active" : ""}`}
                onClick={() => handleFuelTypeSelectionChange({ target: { value: "" } })}
              >
                Все
              </button>
              {fuelOptions.map((fuel) => (
                <button
                  key={fuel}
                  type="button"
                  className={`car-picker-chip ${form.fuelType === fuel ? "car-picker-chip-active" : ""}`}
                  onClick={() => handleFuelTypeSelectionChange({ target: { value: fuel } })}
                >
                  {fuel}
                </button>
              ))}
            </div>
          </div>

          <div className="car-picker-block">
            <div className="car-picker-row-label">Тип ТС</div>
            <div className="car-picker-chips car-picker-chips-scroll" role="listbox" aria-label="Тип автомобиля">
              <button
                type="button"
                className={`car-picker-chip ${carSelection.type === "" ? "car-picker-chip-active" : ""}`}
                onClick={() => handleCarSelectionChange({ target: { name: "type", value: "" } })}
              >
                —
              </button>
              {typeOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`car-picker-chip ${carSelection.type === t ? "car-picker-chip-active" : ""}`}
                  onClick={() => handleCarSelectionChange({ target: { name: "type", value: t } })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="car-picker-block">
            <div className="car-picker-row-label">Марка</div>
            <div className="car-picker-chips car-picker-chips-scroll" role="listbox" aria-label="Марка">
              <button
                type="button"
                className={`car-picker-chip ${carSelection.brand === "" ? "car-picker-chip-active" : ""}`}
                onClick={() => handleCarSelectionChange({ target: { name: "brand", value: "" } })}
              >
                —
              </button>
              {brandOptionGroups.flatMap((g) =>
                g.values.map((value) => (
                  <button
                    key={`${g.letter}-${value}`}
                    type="button"
                    className={`car-picker-chip ${carSelection.brand === value ? "car-picker-chip-active" : ""}`}
                    onClick={() => handleCarSelectionChange({ target: { name: "brand", value } })}
                  >
                    {value}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="car-picker-block">
            <div className="car-picker-row-label">Модель</div>
            <div className="car-picker-chips car-picker-chips-scroll" role="listbox" aria-label="Модель">
              <button
                type="button"
                className={`car-picker-chip ${carSelection.model === "" ? "car-picker-chip-active" : ""}`}
                disabled={!carSelection.brand}
                onClick={() => handleCarSelectionChange({ target: { name: "model", value: "" } })}
              >
                —
              </button>
              {modelOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`car-picker-chip ${carSelection.model === m ? "car-picker-chip-active" : ""}`}
                  disabled={!carSelection.brand}
                  onClick={() => handleCarSelectionChange({ target: { name: "model", value: m } })}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {carSelection.type && carSelection.brand && carSelection.model ? (
            <div className="car-picker-generations">
              <div className="car-picker-gen-head">
                <span className="car-picker-gen-title">Поколение</span>
                {selectedGenerationSummary ? (
                  <span className="car-picker-gen-pill">{selectedGenerationSummary}</span>
                ) : (
                  <span className="car-picker-gen-hint">Выберите карточку</span>
                )}
              </div>
              {generationCandidates.length === 0 ? (
                <div className="car-picker-gen-empty">Нет записей в базе для этой модели и топлива.</div>
              ) : (
                <div className="car-picker-gen-grid">
                  {generationCandidates.map((car) => {
                    const d = buildGenerationCardDisplay(car);
                    const img = resolveCarGenerationImage(car.generationImage || car.coverImage, API_URL);
                    const selected = String(carSelection.pickCarId) === String(car._id);
                    return (
                      <button
                        key={String(car._id)}
                        type="button"
                        className={`car-gen-card ${selected ? "car-gen-card-selected" : ""}`}
                        onClick={() => pickGenerationCar(car)}
                      >
                        <div
                          className="car-gen-card-bg"
                          style={
                            img
                              ? { backgroundImage: `url(${img})` }
                              : undefined
                          }
                        />
                        <div className="car-gen-card-shade" />
                        <span className="car-gen-card-check" aria-hidden>
                          {selected ? "✓" : ""}
                        </span>
                        <div className="car-gen-card-text">
                          <div className="car-gen-card-years">{d.yearsLine}</div>
                          {d.chassis ? <div className="car-gen-card-chassis">{d.chassis}</div> : null}
                          {d.facelift ? <div className="car-gen-card-facelift">рестайлинг</div> : null}
                          {car.volume != null && car.volume !== "" ? (
                            <div className="car-gen-card-vol">{String(car.volume)} л</div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

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
                <div className="attached-list">
                  {existingDocsByKey[item.key].map((file) => (
                    <div key={`${file.key}-${file.index}`} className="attached-item">
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
                <div className="attached-list">
                  {uploadedDocsByKey[item.key].map((file, index) => (
                    <div key={`${file.key}-new-${index}`} className="attached-item">
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
            <div className="attached-list attached-list-photo">
              {existingPhotos.map((file) => (
                <div key={`photo-old-${file.index}`} className="attached-item">
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
            <div className="attached-list attached-list-photo">
              {uploadedPhotos.map((file, index) => (
                <div key={`photo-new-${index}`} className="attached-item">
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
          onChange={(e) => runOcrForFile(ocrTargetRef.current || ocrTarget, e.target.files?.[0])}
        />
        <input
          ref={ocrDocsRef}
          type="file"
          accept=".pdf,image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => runOcrForFile(ocrTargetRef.current || ocrTarget, e.target.files?.[0])}
        />
        <input
          ref={ocrCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => runOcrForFile(ocrTargetRef.current || ocrTarget, e.target.files?.[0])}
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

          <button className="pdf-btn" onClick={openProtocolModal}>
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
                    onChange={handleProtocolFieldChange}
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
                      onChange={handleProtocolFieldChange}
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
                        onChange={handleProtocolFieldChange}
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
                        onChange={handleProtocolFieldChange}
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
                      onChange={handleProtocolFieldChange}
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