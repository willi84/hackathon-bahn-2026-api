import fs from "node:fs/promises";

const SHEET_ID = "1j6ynbOnsiagktQ0sBX2dipWi0cJuJ6-Tgqo4Wp6Rokc";
const TARGET = "docs/data.json";
const SHEET_NAMES = ["ROOMS", "TEAMS"];

function buildSheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

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

function normalizeKey(value) {
  return String(value ?? "").trim();
}

function toItems(rows, cols, startRowIndex = 0) {
  return rows.slice(startRowIndex).map((row) => {
    const item = {};

    for (let index = 0; index < cols.length; index += 1) {
      item[cols[index]] = cell(row, index);
    }

    return item;
  });
}

function toSheetData(data) {
  const labeledCols = data.table?.cols.map((col, index) => col.label || `col_${index}`) || [];
  const rows = data.table?.rows || [];
  const hasOnlyGeneratedLabels = labeledCols.every((col, index) => col === `col_${index}`);

  if (hasOnlyGeneratedLabels && rows.length > 0) {
    const headerCols = labeledCols.map((_, index) => cell(rows[0], index) || `col_${index}`);
    return {
      cols: headerCols,
      items: toItems(rows, headerCols, 1),
    };
  }

  return {
    cols: labeledCols,
    items: toItems(rows, labeledCols),
  };
}

function createEmptyTeamDetails(teamCols) {
  return Object.fromEntries(teamCols.map((col) => [col, ""]));
}

function mergeRoomsWithTeams(rooms, teams) {
  const emptyTeamDetails = createEmptyTeamDetails(teams.cols);
  const teamsByKey = new Map(
    teams.items
      .filter((team) => normalizeKey(team.TEAM))
      .map((team) => [normalizeKey(team.TEAM), team]),
  );

  return rooms.items.map((room) => {
    const teamKey = normalizeKey(room.TEAM);
    const teamDetails = teamKey ? teamsByKey.get(teamKey) || emptyTeamDetails : emptyTeamDetails;

    return {
      ...room,
      TeamDetails: { ...teamDetails },
    };
  });
}

async function fetchSheet(sheetName) {
  const url = buildSheetUrl(sheetName);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} beim Abruf des Sheets ${sheetName}`);
  }

  const text = await res.text();
  return toSheetData(extractJsonFromGviz(text));
}

async function main() {
  const [rooms, teams] = await Promise.all(SHEET_NAMES.map(fetchSheet));
  const roomItems = mergeRoomsWithTeams(rooms, teams);
  const finalData = {
    cols: [...rooms.cols, "TeamDetails"],
    items: roomItems,
    teams,
  };

  await fs.mkdir("docs", { recursive: true });
  await fs.writeFile(TARGET, JSON.stringify(finalData, null, 2), "utf8");

  console.log(`Geschrieben: ${TARGET} (${roomItems.length} ROOMS, ${teams.items.length} TEAMS)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
