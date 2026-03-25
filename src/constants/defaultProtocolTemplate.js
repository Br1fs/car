export const defaultProtocolTemplate = {
  category: "",
  fuelType: "",
  protocolNumber: "",
  protocolDate: "",
  logoFile: null,
  sig1File: null,
  sig2File: null,
  sig3File: null,

  countryText: `Қазақстан Республикасы
Мемлекеттік техникалық реттеу жүйесі
ЖШС «Ala-test» сынақ зертханасы
2025 жыл «19» желтоқсан
№ KZ.T.02.2997`,
  
  accreditationText: `Государственная система технического
регулирования Республики Казахстан
Испытательная лаборатория
Аттестат аккредитации
№ KZ.T.02.2997
от «19» декабря 2025 г.`,

  address: "",

  identificationResults: [
    { label: "Марка", value: "" },
    { label: "VIN", value: "" },
    { label: "ФИО", value: "" },
    { label: "Тип", value: "" },
    { label: "Год выпуска", value: "" },
    { label: "Объём двигателя", value: "" },
    { label: "Категория", value: "" },
    { label: "Экологический Класс", value: "" },
    { label: "ИЗГОТОВИТЕЛЬ", value: "" },
    { label: "-юридический адрес ИЗГОТОВИТЕЛЯ", value: "" },
    { label: "-фактический адрес ИЗГОТОВИТЕЛЯ", value: "" },
    { label: "СБОРОЧНЫЙ ЗАВОД", value: "" },
    { label: "-Адрес СБОРОЧНОГО ЗАВОДА", value: "" },
    { label: "Колесная формула", value: "" },
    { label: "ведущие колеса", value: "" },
    { label: "Схема компоновки транспортного средства", value: "" }
  ],

  testConditions: [
    { label: "Температура воздуха", value: "" },
    { label: "Относительная влажность воздуха", value: "" },
    { label: "Частота переменного тока", value: "" },
    { label: "Напряжение сети", value: ["", "", "", "", "", "", "", ""] },
    { label: "Атмосферное давление", value: "" }
  ],

  testEquipment: Array.from({ length: 14 }, (_, i) => ({
    number: i + 1,
    name: "",
    certificate: ""
  })),

  technicalResults: Array.from({ length: 20 }, () => ({
    parameter: "",
    method: "",
    normValue: "",
    actualValue: ""
  }))
};
