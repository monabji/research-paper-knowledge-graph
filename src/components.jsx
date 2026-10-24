import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Banner } from "ascii.rest/react";
export const fmt = (n) => Number(n || 0).toLocaleString();
export const label = (s) => s.replaceAll("_", " ");
export const code = (id) => "P-" + String(id).padStart(3, "0");
export function Btn({ children, primary = false, danger = false, ...props }) {
  return (
    <button
      className={`btn ${primary ? "primary" : ""} ${danger ? "danger" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Rule({ children }) {
  return (
    <div className="rule">
      <span aria-hidden="true">── </span>
      <b>{children}</b>
      <span aria-hidden="true"> {"─".repeat(160)}</span>
    </div>
  );
}
export function Heading({ text, subtitle, children }) {
  return (
    <div className="heading">
      <div>
        <div className="banner-wrap">
          <Banner
            text={text}
            color={["#f5a623", "#ff6a3d"]}
            shadow="rounded"
            effect="glint"
            label={text}
          />
        </div>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div className="heading-side">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  foot = "",
  children,
  className = "",
  ...props
}) {
  const outer = useRef(),
    inner = useRef();
  const [frame, setFrame] = useState({ cols: 20, rows: 3, line: 20 });
  useLayoutEffect(() => {
    const el = outer.current,
      content = inner.current;
    let raf;
    const draw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el.isConnected || !el.clientWidth) return;
        const cs = getComputedStyle(el);
        const line = parseFloat(cs.lineHeight);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const cw = ctx.measureText("M").width;
        const rows = Math.max(
          3,
          Math.ceil(
            (content.getBoundingClientRect().height + line * 2.2) / line,
          ),
        );
        const cols = Math.max(8, Math.floor(el.clientWidth / cw));
        el.style.minHeight = rows * line + "px";
        setFrame((old) =>
          old.cols === cols && old.rows === rows && old.line === line
            ? old
            : { cols, rows, line },
        );
      });
    };
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    ro.observe(content);
    document.fonts.ready.then(draw);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  const { cols, rows } = frame;
  const t = title.slice(0, cols - 6),
    f = foot.slice(0, Math.max(0, cols - 6));
  return (
    <div ref={outer} className={`tui ${className}`} {...props}>
      <pre className="edge" aria-hidden="true">
        {"╭─ "}
        <b>{t}</b>
        {" " + "─".repeat(Math.max(0, cols - t.length - 5)) + "╮\n"}
        {Array.from(
          { length: rows - 2 },
          () => "│" + " ".repeat(cols - 2) + "│",
        ).join("\n")}
        {"\n╰" + "─".repeat(Math.max(0, cols - f.length - (f ? 5 : 2)))}
        {f && (
          <>
            {" "}
            <i>{f}</i> ─
          </>
        )}
        {"╯"}
      </pre>
      <div className="panel-content" ref={inner}>
        {children}
      </div>
    </div>
  );
}
export function Field({ title, id, children, className = "" }) {
  return (
    <div className={"form-row " + className}>
      <span className="cursor" aria-hidden="true">
        &gt;
      </span>
      <label htmlFor={id}>{title}</label>
      <span className="field">{children}</span>
    </div>
  );
}
export function Select({
  value,
  onChange,
  children,
  label: ariaLabel,
  ...props
}) {
  return (
    <span className="select-wrap">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        {...props}
      >
        {children}
      </select>
      <span aria-hidden="true">⌄</span>
    </span>
  );
}
export function Check({ children, ...props }) {
  return (
    <label className="check">
      <input type="checkbox" {...props} />
      <span className="check-mark" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}
export function ErrorLine({ error }) {
  return error ? (
    <p className="bad" role="alert">
      ! {error}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <p className="loading" role="status">
      <span>⠋</span> loading records…
    </p>
  );
}
export function Empty({ children }) {
  return <p className="empty">{children || "no records yet."}</p>;
}
export function ConfirmDelete({ onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <span className="delete-control">
      {confirm && <span className="dim">press again to confirm · </span>}
      <Btn danger onClick={() => (confirm ? onDelete() : setConfirm(true))}>
        {confirm ? "yes, delete it" : "delete"}
      </Btn>
      {confirm && <Btn onClick={() => setConfirm(false)}>cancel</Btn>}
    </span>
  );
}
export function Table({ rows, onPaper, columns }) {
  if (!rows.length) return <Empty>no results for this query.</Empty>;
  const keys = columns || Object.keys(rows[0]);
  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{label(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>
                  {k === "paper_id" && onPaper ? (
                    <button
                      className="text-link"
                      onClick={() => onPaper(r.paper_id)}
                    >
                      {code(r.paper_id)}
                    </button>
                  ) : r[k] === null ? (
                    <span className="dim">—</span>
                  ) : (
                    String(r[k])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Meter({ value, max = 1, width = 18 }) {
  const filled = Math.min(
    width,
    Math.round((value / Math.max(1, max)) * width),
  );
  return (
    <span className="meter" aria-label={`${value} of ${max}`}>
      <span>{"━".repeat(filled)}</span>
      <span className="faint">{"─".repeat(width - filled)}</span>
    </span>
  );
}
