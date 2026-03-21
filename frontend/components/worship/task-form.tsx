"use client";

import { useEffect, useMemo, useState } from "react";

import { listWorshipSlideTemplates, lookupWorshipSongs } from "@/lib/api";
import type {
  WorshipSlideTemplate,
  WorshipSongLookupItem,
  WorshipTaskFieldSpec,
} from "@/lib/types";

type Values = Record<string, unknown>;

type WorshipTaskFormProps = {
  fields: WorshipTaskFieldSpec[];
  values: Values;
  onChange: (key: string, value: string) => void;
  className?: string;
};

function inputClassName(className?: string) {
  return className ?? "rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function WorshipSongSearchField({
  value,
  helpText,
  onChange,
  className,
}: {
  value: string;
  helpText: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [results, setResults] = useState<WorshipSongLookupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        setResults(await lookupWorshipSongs(query));
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="grid gap-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName(className)}
      />
      {helpText ? <span className="text-xs text-slate-500">{helpText}</span> : null}
      {isLoading ? <span className="text-xs text-slate-500">검색 중...</span> : null}
      {results.length ? (
        <div className="grid gap-2 rounded-[18px] border border-slate-200 bg-slate-50 p-3">
          {results.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.title)}
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700"
            >
              <div className="font-medium text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs text-slate-500">{item.artist}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WorshipTaskFieldRenderer({
  field,
  value,
  onChange,
  slideTemplates,
  className,
}: {
  field: WorshipTaskFieldSpec;
  value: string;
  onChange: (value: string) => void;
  slideTemplates: WorshipSlideTemplate[];
  className?: string;
}) {
  switch (field.fieldType) {
    case "textarea":
    case "lyrics":
      return (
        <textarea
          rows={field.fieldType === "lyrics" ? 10 : 6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName(className)}
        />
      );
    case "scripture":
      return (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="요한복음 3:16-17"
          className={inputClassName(className)}
        />
      );
    case "slide_template":
      return (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName(className)}
        >
          <option value="">템플릿 없음</option>
          {slideTemplates.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label} ({item.key})
            </option>
          ))}
        </select>
      );
    case "song_search":
      return (
        <WorshipSongSearchField
          value={value}
          helpText={field.helpText}
          onChange={onChange}
          className={className}
        />
      );
    default:
      return (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName(className)}
        />
      );
  }
}

export function WorshipTaskForm({
  fields,
  values,
  onChange,
  className,
}: WorshipTaskFormProps) {
  const [slideTemplates, setSlideTemplates] = useState<WorshipSlideTemplate[]>([]);

  useEffect(() => {
    let active = true;
    void listWorshipSlideTemplates()
      .then((items) => {
        if (active) {
          setSlideTemplates(items.filter((item) => item.isActive));
        }
      })
      .catch(() => {
        if (active) {
          setSlideTemplates([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedFields = useMemo(
    () =>
      fields.map((field) => ({
        ...field,
        binding: field.binding ?? "value",
      })),
    [fields],
  );

  return (
    <div className="grid gap-3">
      {normalizedFields.map((field) => {
        const value = normalizeString(values[field.key]);
        return (
          <label key={field.key} className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              {field.label}
              {field.required ? <span className="ml-1 text-rose-500">*</span> : null}
            </span>
            <WorshipTaskFieldRenderer
              field={field}
              value={value}
              onChange={(nextValue) => onChange(field.key, nextValue)}
              slideTemplates={slideTemplates}
              className={className}
            />
            {field.helpText && field.fieldType !== "song_search" ? (
              <span className="text-xs text-slate-500">{field.helpText}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
