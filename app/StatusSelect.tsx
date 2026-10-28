"use client";

import { useState, useTransition } from "react";
import { STATUS } from "@/lib/constants";
import { setTopicStatus } from "./actions";

const OPTIONS = Object.values(STATUS);

const toneOf = (status: string) =>
  status === STATUS.DONE ? "done" : status === STATUS.NEEDS_WORK ? "needs" : status === STATUS.NOT_STARTED ? "pending" : "review";

/** Status badge that doubles as a dropdown; saving writes straight to the tracker file. */
export default function StatusSelect({ row, status }: { row: number; status: string }) {
  const [value, setValue] = useState(status || STATUS.NOT_STARTED);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="status-select">
      <select
        aria-label="Status"
        className={`badge ${toneOf(value)}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = value;
          setValue(next);
          setError("");
          startTransition(async () => {
            const result = await setTopicStatus(row, next);
            if (result.error) {
              setValue(previous);
              setError(result.error);
            }
          });
        }}
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {pending && <span className="muted small"> saving…</span>}
      {error && <div className="overdue small">{error}</div>}
    </div>
  );
}
