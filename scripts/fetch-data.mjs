import fs from "node:fs/promises";

const SHEET_ID = "1j6ynbOnsiagktQ0sBX2dipWi0cJuJ6-Tgqo4Wp6Rokc";
const GID = "2105428099"; // ggf. anpassen
const TARGET = "docs/names.json";
const URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

function extractJsonFromGviz(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Konnte gviz-Wrapper nicht parsen");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function cell(row, index) {
  if (!row || !row.c || !row.c[index] || row.c[index].v == null) {
    return "";
  }
  return String(row.c[index].v).trim();
}

async function main() {
  const res = await fetch(URL);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} beim Abruf des Sheets`);
  }

  const text = await res.text();
  const data = extractJsonFromGviz(text);
  const rows = data.table?.rows || [];

  if (!rows.length) {
    throw new Error("Keine Zeilen im Sheet gefunden");
  }

  const headerRow = rows[0];
  const headers = (headerRow.c || []).map((c) =>
    c && c.v != null ? String(c.v).trim() : ""
  );

  const items = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};

    for (let col = 0; col < headers.length; col++) {
      const key = headers[col] || `col_${col}`;
      obj[key] = cell(row, col);
    }

    if (obj.Name) {
      items.push(obj);
    }
  }

  await fs.mkdir("docs", { recursive: true });
  await fs.writeFile(TARGET, JSON.stringify(items, null, 2), "utf8");

  console.log(`Geschrieben: ${TARGET} (${items.length} Einträge)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});