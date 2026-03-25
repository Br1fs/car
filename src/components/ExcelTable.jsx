import { useState, useEffect } from "react";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css"; // полный CSS Handsontable

export default function ExcelTable() {
  const storageKey = "excelData";
  const rows = 40;  
  const cols = 10;

  // Генерация начальных данных
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

  // Динамическая высота таблицы
  const tableHeight = window.innerHeight - 80; // вычитаем navbar

  return (
    <div
      className="excel-container"
      style={{
        width: "100%",
        height: tableHeight,
        overflow: "auto",
      }}
    >
      <HotTable
        data={data}
        colHeaders={true}
        rowHeaders={true}
        width="100%"
        height={tableHeight}
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"               // растягиваем колонки по ширине
        rowHeights={40}              // высота строки
        colWidths={150}              // ширина колонки
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
