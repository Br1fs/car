const safe = (value) => (value === undefined || value === null ? "" : String(value).trim());

const parsePowerValue = (value) => {
  const text = safe(value);
  if (!text) return "";
  const normalized = text.replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : text;
};

const TECHREG_LISTBOX_PRESETS = {
  listbox_decision_conclusion: { value: "Положительное", key: "1" },
  listbox_decision_il: { value: "Положительное", key: "1" },
  listbox_check_app: { value: "Положительное", key: "1" },
  listbox_engine_type: { value: "Двигатель внутреннего сгорания", key: "1" },
  listbox_unit_length: { value: "Миллиметр", key: "266" },
  listbox_unit_width: { value: "Миллиметр", key: "266" },
  listbox_unit_height: { value: "Миллиметр", key: "266" },
  listbox_code_id_mass: { value: "Килограмм", key: "296" },
  listbox_code_id_mass_copy1: { value: "Килограмм", key: "296" },
};

const buildField = (id, type, value) => ({ id, type, value: safe(value) });
const buildListbox = (id, value, key) => ({ id, type: "listbox", value: safe(value), key: safe(key) });
const buildReglink = (id, value) => ({ id, type: "reglink", value: safe(value) });

export function buildTechregPayload(application = {}) {
  const app = application || {};

  const payload = [
    // --- Заявитель ---
    buildField("textbox_address", "textbox", app.address),
    buildField("textbox_address_fact", "textbox", app.address),
    buildField("textbox_email", "textbox", app.email),
    buildField("textbox_phone", "textbox", app.phone),

    // --- Изготовитель ---
    buildField("textbox_legal_address", "textbox", app.legaladdressoftheMANUFACTURER),
    buildField("textarea-juniae_copy1", "textarea", app.MANUFACTURER),
    buildField("textbox_address_manuf", "textbox", app.actualaddressoftheMANUFACTURER || app.legaladdressoftheMANUFACTURER),
    buildReglink("reglink_manuf_ts", app.MANUFACTURER),
    buildReglink("reglink_manuf_ts_inostr", app.MANUFACTURER),

    // --- Сборочный завод ---
    buildField("textarea-juniae_copy3", "textarea", app.ASSEMBLYPLANT),
    buildField("textbox_address_assembly_plant", "textbox", app.addressoftheassemblyplant),
    buildReglink("reglink_assembly_plant_inostr", app.ASSEMBLYPLANT),

    // --- Характеристики ТС ---
    buildField("textbox_id_number", "textbox", app.vin),
    buildField("textbox_type_identifier", "textbox", app.typ),
    buildField("textbox_year", "textbox", app.year),
    buildField("textarea_commercial_name", "textarea", app.model),
    buildField("textbox_name_mark", "textbox", app.brand),
    buildReglink("reglink_mark", app.brand),
    buildListbox("listbox_category", app.category, ""),
    buildListbox("listbox_ecological_class", app.EcologicalClass, ""),
    buildField("textbox_length", "textbox", app.length),
    buildField("textbox_width", "textbox", app.width),
    buildField("textbox_height", "textbox", app.height),
    buildField("textbox_wheelbases", "textbox", app.base),
    buildField("textbox_track_front_rear_wheels", "textbox", app.Wheeltrack),
    buildField("textbox_number_of_seats", "textbox", app.seats),
    buildField("textbox_body_type", "textbox", app.bodyType),
    buildField("textbox_engine_brand", "textbox", app.engine),
    buildField("numericinput_number_of_engine_cylinders", "numericinput", app.cylinders),
    buildField("numericinput_engine_cylinder_displacement", "numericinput", app.cylinderVolume),
    buildField("numericinput_engine_compression_ratio", "numericinput", app.compressionratio),
    buildField("numericinput_maximum_power", "numericinput", parsePowerValue(app.power)),
    buildListbox("listbox_name_fuel", app.fuel, ""),
    buildListbox("textarea_power_system_description", app.Powersystem, ""),
    buildListbox("textarea_ignition", app.Ignitionsystem, ""),
    buildField("textarea_exhaust", "textarea", app.Exhaustsystem),
    buildListbox("textarea_transmission", app.transmission, ""),
    buildField("textbox_cp_type", "textbox", app.Transmissionbox),
    buildField("textarea_front_suspension", "textarea", app.frontSuspension),
    buildField("textarea_back_suspension", "textarea", app.rearSuspension),
    buildField("textbox_mark_steering", "textbox", app.steering),
    buildField("textarea_braking_description", "textarea", app.brakes),
    buildField("textarea_braking_description_copy1", "textarea", app.brakes1),
    buildField("textarea_braking_description_copy2", "textarea", app.brakes2),
    buildField("textarea_braking_description_copy3", "textarea", app.brakes3),
    buildField("textbox_size_tires", "textbox", app.tires),
    buildListbox("listbox_wheel_formula", app.Wheelarrangement, ""),
    buildField("textbox_driving_wheels", "textbox", app.drivingwheels),
    buildField("textbox_min", "textbox", app.curbWeight),
    buildField("textbox_min_2", "textbox", app.maxWeight),
  ];

  Object.entries(TECHREG_LISTBOX_PRESETS).forEach(([id, preset]) => {
    payload.push(buildListbox(id, preset.value, preset.key));
  });

  return {
    data: payload,
    meta: {
      skippedAsAutoFilled: [
        "textbox_fio_user",
        "textbox_firstname_user",
        "textbox_lastname_user",
        "textbox_patronymic_user",
        "textbox_iin",
        "textbox_uveos",
      ],
      skippedAsNotRequired: [
        "textbox_address_kz",
        "textextbox_address_fact_kz",
        "textbox_legal_address_kz",
        "textbox_fact_address_kz",
      ],
      requiresInteractiveSelection: [
        "reglink_mark",
        "reglink_manuf_ts",
        "reglink_manuf_ts_inostr",
        "reglink_assembly_plant_inostr",
        "listbox_name_fuel",
        "listbox_ecological_class",
        "textarea_power_system_description",
        "textarea_ignition",
        "textarea_transmission",
        "listbox_category",
        "listbox_wheel_formula",
      ],
      tabs: {
        applicant: ["textbox_address", "textbox_address_fact", "textbox_email", "textbox_phone"],
        manufacturer: ["textarea-juniae_copy1", "textbox_legal_address", "textbox_address_manuf", "reglink_manuf_ts", "reglink_manuf_ts_inostr"],
        assembly: ["textarea-juniae_copy3", "textbox_address_assembly_plant", "reglink_assembly_plant_inostr"],
      },
    },
  };
}
