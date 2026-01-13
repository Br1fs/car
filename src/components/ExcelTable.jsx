import { useState, useEffect } from "react";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.css";

export default function ExcelTable() {
  const storageKey = "excelData";
  const rows = 100;  // количество строк
  const cols = 20;   // количество колонок

  // Генерация данных с заголовками в первой строке
  const generateData = () =>
    Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: cols }, (_, colIndex) =>
        rowIndex === 0 ? `Колонка ${colIndex + 1}` : ""
      )
    );

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : generateData();
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data]);

  return (
    <div
      style={{width: "100%", height: "600px" /* фиксированная высота */, padding: 0 }}
    >
      <HotTable
        data={data}
        colHeaders={true}
        rowHeaders={true}
        width="100%"
        height="600"
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        rowHeights={40}
        colWidths={150}
        manualColumnResize={true}
        manualRowResize={true}
        manualColumnMove={true}
        manualRowMove={true}
        contextMenu={true}
        fixedRowsTop={1}
        afterChange={(changes, source) => {
          if (
            source === "edit" ||
            source === "insert_row" ||
            source === "insert_col" ||
            source === "remove_row" ||
            source === "remove_col"
          ) {
            setData([...data]);
          }
        }}
      />
    </div>
  );
}
