export function buildCharacteristics(form) {
  const characteristics = [];

  // ===== ОСНОВНЫЕ ДАННЫЕ =====
  characteristics.push(
    { label: "Тип АВТОМОБИИЛЯ ", value: form.type, key: "type" },
    { label: "Тип", value: form.typ, key: "typ" },
    { label: "Марка", value: form.brand, key: "brand" },
    { label: "КОММЕРЧЕСКОЕ НАИМЕНОВАНИЕ", value: form.model, key: "model" },
    { label: "VIN", value: form.vin, key: "vin" },
    { label: "Год выпуска", value: form.year, key: "year" },
    { label: "Объём двигателя", value: form.volume, key: "volume" },
    { label: "Категория", value: form.category, key: "category" },
    { label: "Экологический Класс", value: form.EcologicalClass, key: "EcologicalClass" },
    { label: "Заявитель", value: form.fio, key: "fio" },
    { label: "ИИН", value: form.iin, key: "iin" },
    { label: "Адрес заявителя", value: form.address, key: "address" },
    { label: "Телефон", value: form.phone, key: "phone" },
    { label: "ИЗГОТОВИТЕЛЬ", value: form.MANUFACTURER, key: "MANUFACTURER" },
    { label: "-юридический адрес ИЗГОТОВИТЕЛЬЯ", value: form.legaladdressoftheMANUFACTURER, key: "legaladdressoftheMANUFACTURER" },
    { label: "-фактический адрес ИЗГОТОВИТЕЛЬЯ", value: form.actualaddressoftheMANUFACTURER, key: "actualaddressoftheMANUFACTURER" },
    { label: "СБОРОЧНЫЙ ЗАВОД", value: form.ASSEMBLYPLANT, key: "ASSEMBLYPLANT" },
    { label: "-Адрес СБОРОЧНОГО ЗАВОДА", value: form.addressoftheassemblyplant, key: "addressoftheassemblyplant" },
    { label: "Колесная формула", value: form.Wheelarrangement, key: "Wheelarrangement" },
    { label: "ведущие колеса", value: form.drivingwheels, key: "drivingwheels" },
    { label: "Схема компоновки транспортного средства", value: form.Vehiclelayoutdiagram, key: "Vehiclelayoutdiagram" }
  );

  // ===== Динамические поля по категориям =====
  if (form.category === "M1") {
    characteristics.push(
      { label: "Тип кузова / двери", value: form.bodyType, key: "bodyType" },
      { label: "Количество мест спереди/сзади", value: form.seats, key: "seats" }
    );
  }

  if (form.category=== "N3") {
    characteristics.push(
      { label: "Исполнение загрузочного пространства", value: form.loadSpace, key: "loadSpace" },
      { label: "Кабина", value: form.cab, key: "cab" }
    );
  }

  if (form.category === "L") {
    characteristics.push(
      { label: "Рама", value: form.frame, key: "frame" }
    );
  }

  if (form.category === "O4") {
    characteristics.push(
      { label: "Количество осей / колес", value: form.axles, key: "axles" }
    );
  }

  // ===== Общие технические характеристики =====
  characteristics.push(
    { label: "Масса транспортного средства в снаряженном состоянии, кг", value: form.curbWeight, key: "curbWeight" },
    { label: "Технически допустимая максимальная масса транспортного средства, кг", value: form.maxWeight, key: "maxWeight" },
    { label: "Габаритные размеры", value: form.overallsize, key: "overallsize" },
    { label: "Длина", value: form.length, key: "length" },
    { label: "Ширина", value: form.width, key: "width" },
    { label: "Высота", value: form.height, key: "height" },
    { label: "База", value: form.base, key: "base" },
    { label: "Колея передних/задних колес, мм", value: form.Wheeltrack, key: "Wheeltrack" },
    { label: "Описание гибридного транспортного средства", value: form.Descriptionhybrid, key: "Descriptionhybrid" },
    { label: "Двигатель внутреннего сгорания (марка, тип)", value: form.engine, key: "engine" },
    { label: "- количество и расположение цилиндров", value: form.cylinders, key: "cylinders" },
    { label: "- рабочий объем цилиндров, см3", value: form.cylinderVolume, key: "cylinderVolume" },
    { label: "- степень сжатия", value: form.compressionratio, key: "compressionratio" },
    { label: "- максимальная мощность, кВт (мин.-1)", value: form.power, key: "power" },
    { label: "Топливо", value: form.fuel, key: "fuel" },
    { label: "Система питания (тип)", value: form.Powersystem, key: "Powersystem" },
    { label: "Система зажигания (тип)", value: form.Ignitionsystem, key: "Ignitionsystem" },
    { label: "Система выпуска и нейтрализации отработавших газов", value: form.Exhaustsystem, key: "Exhaustsystem" },
    { label: "Электродвигатель электромобиля", value: form.electricMotor, key: "electricMotor" },
    { label: "Рабочее напряжение, В", value: form.emVoltage, key: "emVoltage" },
    { label: "Макс. мощность 30 мин ЭМ", value: form.maxPowerEM, key: "maxPowerEM" },
    { label: "Устройство накопления энергии ", value: form.Energystorage, key: "Energystorage" },
    { label: "Трансмиссия", value: form.transmission, key: "transmission" },
    { label: "Электромашина (марка, тип)", value: form.Electricmachine, key: "Electricmachine" },
    { label: "Рабочее напряжение, В (для гибрида)", value: form.emVoltage1, key: "emVoltage1" },
    { label: "Макс. мощность 30 мин ЭМ (для гибрида)" , value: form.maxPowerEM1, key: "maxPowerEM1" },
    { label: "Сцепление", value: form.clutch, key: "clutch" },
    { label: "Коробка передач (марка, тип)", value: form.Transmissionbox, key: "Transmissionbox" },
    { label: "Подвеска передняя", value: form.frontSuspension, key: "frontSuspension" },
    { label: "Подвеска задняя", value: form.rearSuspension, key: "rearSuspension" },
    { label: "Рулевое управление", value: form.steering, key: "steering" },
    { label: "Тормозные системы (тип):", value: form.brakes, key: "brakes" },
    { label: "- рабочая", value: form.brakes1, key: "brakes1" },
    { label: "- запасная", value: form.brakes2, key: "brakes2" },
    { label: "- стояночная", value: form.brakes3, key: "brakes3" },
    { label: "Шины", value: form.tires, key: "tires" },
    { label: "Дополнительное оборудование", value: form.extraEquipment, key: "extraEquipment" }
  );

  return characteristics;
}
