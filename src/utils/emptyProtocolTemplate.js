const emptyProtocolTemplate = {
  name: "",
  sections: [
    {
      id: "general",
      title: "Общие сведения",
      rows: [
        { label: "Марка", key: "brand" },
        { label: "Модель", key: "model" },
        { label: "VIN", key: "vin" }
      ]
    }
  ]
};

export default emptyProtocolTemplate;
