export function buildCharacteristics(form) {
  const characteristics = [];

  // ===== ОСНОВНЫЕ ДАННЫЕ =====
  characteristics.push(
    { label: "Марка", value: form.brand },
    { label: "Коммерческое наименование", value: form.model },
    { label: "Тип ТС", value: form.carType },
    { label: "VIN", value: form.vin },
    { label: "Год выпуска", value: form.year },
    { label: "Объем двигателя", value: form.volume },
    { label: "Категория", value: form.category },
    { label: "Экологический класс", value: "Евро-5" },

    { label: "Заявитель", value: form.fio },
    { label: "Адрес заявителя", value: form.address },
    { label: "Телефон", value: form.phone },
    { label: "Email", value: form.email }
  );

  // ===== ИЗГОТОВИТЕЛЬ =====
  characteristics.push(
    { label: "Изготовитель (юр. адрес)", value: form.manufacturerLegal },
    { label: "Изготовитель (факт. адрес)", value: form.manufacturerActual }
  );

  // ===== СБОРОЧНЫЙ ЗАВОД =====
  characteristics.push(
    { label: "Сборочный завод (юр. адрес)", value: form.factoryLegal },
    { label: "Сборочный завод (факт. адрес)", value: form.factoryActual }
  );

  // ===== УСЛОВНЫЕ ПОЛЯ ПО КАТЕГОРИЯМ =====

  // M1 — легковые
  if (form.category === "M1") {
    characteristics.push(
      {
        label: "Количество мест спереди / сзади",
        value: form.seats
      },
      {
        label: "Тип кузова / количество дверей",
        value: form.bodyType
      }
    );
  }

  // N — грузовые
  if (form.category?.startsWith("N")) {
    characteristics.push(
      {
        label: "Исполнение загрузочного пространства",
        value: form.loadSpace
      },
      {
        label: "Кабина",
        value: form.cab
      }
    );
  }

  // L — мото
  if (form.category === "L") {
    characteristics.push({
      label: "Рама",
      value: form.frame
    });
  }

  // O — прицепы
  if (form.category === "O") {
    characteristics.push({
      label: "Количество осей / колес",
      value: form.axles
    });
  }

  // ===== ОБЩИЕ ТЕХНИЧЕСКИЕ =====
  characteristics.push(
    { label: "Масса снаряженная, кг", value: form.curbWeight },
    { label: "Максимальная масса, кг", value: form.maxWeight },
    {
      label: "Габариты (Д×Ш×В)",
      value: `${form.length} × ${form.width} × ${form.height}`
    },
    { label: "База, мм", value: form.base },
    { label: "Шины", value: form.tires }
  );

  return characteristics;
}
