export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "request failed");
  return data;
}
export const send = (path, method, body) =>
  api(path, { method, body: JSON.stringify(body) });
export function downloadCSV(rows, name = "research-export.csv") {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter(
    (k) => !Array.isArray(rows[0][k]) && typeof rows[0][k] !== "object",
  );
  const quote = (value) => {
    let text = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [
          keys.map(quote).join(","),
          ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
        ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
