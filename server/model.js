export const entities = {
  paper: {
    id: "paper_id",
    label: "papers",
    fields: {
      title: { required: true, max: 1000 },
      abstract: { required: true, type: "text" },
      doi: { max: 255 },
      publication_year: { required: true, type: "year" },
      paper_type: { required: true, max: 50 },
      url: { type: "url", max: 2048 },
      venue_id: { type: "id", ref: "venue" },
    },
  },
  author: {
    id: "author_id",
    label: "authors",
    fields: {
      full_name: { required: true, max: 255 },
      orcid: { max: 19 },
      email: { type: "email", max: 320 },
    },
  },
  institution: {
    id: "institution_id",
    label: "institutions",
    fields: {
      name: { required: true, max: 255 },
      country: { max: 100 },
      website: { type: "url", max: 2048 },
    },
  },
  venue: {
    id: "venue_id",
    label: "venues",
    fields: {
      name: { required: true, max: 255 },
      venue_type: { required: true, max: 50 },
      publisher: { max: 255 },
    },
  },
  dataset: {
    id: "dataset_id",
    label: "datasets",
    fields: {
      name: { required: true, max: 255 },
      description: { type: "text" },
      source_url: { type: "url", max: 2048 },
    },
  },
  method: {
    id: "method_id",
    label: "methods",
    fields: {
      name: { required: true, max: 255 },
      description: { type: "text" },
    },
  },
  keyword: {
    id: "keyword_id",
    label: "keywords",
    fields: { keyword: { required: true, max: 255 } },
  },
};
export const relations = {
  authorship: ["paper_id", "author_id", "author_order", "is_corresponding"],
  author_institution: ["author_id", "institution_id", "start_year", "end_year"],
  paper_dataset: ["paper_id", "dataset_id"],
  paper_method: ["paper_id", "method_id"],
  paper_keyword: ["paper_id", "keyword_id"],
  citation: ["citing_paper_id", "cited_paper_id"],
};
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function validateEntity(type, body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError(400, "record must be an object");
  const result = {};
  for (const [key, config] of Object.entries(entities[type].fields)) {
    let value = body[key];
    if (typeof value === "string") value = value.trim();
    if (value === undefined || value === null || value === "") {
      if (config.required)
        throw new HttpError(400, `${key.replaceAll("_", " ")} is required`);
      result[key] = null;
      continue;
    }
    if (config.type === "id" || config.type === "year") {
      value = Number(value);
      if (
        !Number.isInteger(value) ||
        (config.type === "year" ? value < 1000 || value > 2100 : value < 1)
      )
        throw new HttpError(400, `${key.replaceAll("_", " ")} is invalid`);
    } else {
      if (typeof value !== "string")
        throw new HttpError(400, `${key} must be text`);
      if (config.max && value.length > config.max)
        throw new HttpError(
          400,
          `${key} must be at most ${config.max} characters`,
        );
      if (config.type === "url" && !/^https?:\/\/\S+$/i.test(value))
        throw new HttpError(400, `${key} must be an http or https URL`);
      if (config.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        throw new HttpError(400, "email is invalid");
      if (key === "orcid" && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value))
        throw new HttpError(400, "ORCID must use 0000-0000-0000-0000 format");
    }
    result[key] = value;
  }
  return result;
}
export function positiveInt(value, label = "id") {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new HttpError(400, `${label} must be a positive integer`);
  return n;
}
