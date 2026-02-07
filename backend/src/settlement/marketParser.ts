export type ParsedMarket = {
  marketType: string;
  selection: string;
  line: number | null;
};

const parseOverUnder = (text: string): ParsedMarket | null => {
  const match = text.match(/\b(over|under)\s*(\d+(?:\.\d+)?)\b/i);
  if (!match) return null;
  return {
    marketType: "over_under",
    selection: match[1].toLowerCase(),
    line: Number(match[2]),
  };
};

export const parseBetTypeToMarket = (raw: string): ParsedMarket => {
  const value = raw.trim().toLowerCase();

  const ou = parseOverUnder(value);
  if (ou) return ou;

  if (["draw", "x"].includes(value)) return { marketType: "1x2", selection: "draw", line: null };
  if (["home win", "home", "1"].includes(value)) return { marketType: "1x2", selection: "home", line: null };
  if (["away win", "away", "2"].includes(value)) return { marketType: "1x2", selection: "away", line: null };
  if (["btts", "both teams to score", "btts yes", "gg"].includes(value)) return { marketType: "btts", selection: "yes", line: null };
  if (["btts no", "both teams not to score", "ng"].includes(value)) return { marketType: "btts", selection: "no", line: null };

  return { marketType: "custom", selection: raw.trim(), line: null };
};