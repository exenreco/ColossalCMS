const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
import { mailAddress } from "../../server/mail.mjs";
export const MESSAGING_ID = "com.colossal.messaging";
export const defaults = {
  enabled: true,
  title: "Send us a message",
  description: "Have a question or an idea? We’d love to hear from you.",
  submitLabel: "Send message",
  successMessage: "Thank you! Your message has been received.",
  notify: true,
  recipient: "",
  fields: [
    {
      key: "name",
      label: "Name",
      type: "text",
      required: true,
      placeholder: "Your name",
      options: [],
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "john@example.com",
      options: [],
    },
    {
      key: "message",
      label: "Message",
      type: "textarea",
      required: true,
      placeholder: "How can we help?",
      options: [],
    },
  ],
};
export const fieldTypes = [
  "text",
  "email",
  "textarea",
  "tel",
  "url",
  "number",
  "select",
  "checkbox",
];
export function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Check the message form settings.");
  const clean = { ...defaults, ...input };
  for (const key of [
    "title",
    "description",
    "submitLabel",
    "successMessage",
    "recipient",
  ]) {
    if (
      typeof clean[key] !== "string" ||
      clean[key].length >
        (key === "description" || key === "successMessage" ? 500 : 160)
    )
      fail("Check the form " + key + ".");
    clean[key] = clean[key].trim();
  }
  if (!clean.title || !clean.submitLabel || !clean.successMessage)
    fail("Add a title, submit label and confirmation message.");
  if (clean.recipient) mailAddress(clean.recipient);
  if (
    !Array.isArray(clean.fields) ||
    clean.fields.length < 1 ||
    clean.fields.length > 20
  )
    fail("Use 1–20 form fields.");
  const keys = new Set();
  clean.fields = clean.fields.map((field) => {
    if (
      !field ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(field.key || "") ||
      ["website", "token", "sourcepath"].includes(field.key) ||
      keys.has(field.key) ||
      !fieldTypes.includes(field.type) ||
      typeof field.label !== "string" ||
      !field.label.trim() ||
      field.label.length > 100
    )
      fail("Each form field needs a unique key, label and valid type.");
    keys.add(field.key);
    const options = Array.isArray(field.options) ? field.options : [];
    if (
      options.length > 20 ||
      options.some(
        (value) =>
          typeof value !== "string" || !value.trim() || value.length > 100,
      ) ||
      new Set(options).size !== options.length ||
      (field.type === "select" && !options.length)
    )
      fail("Select fields need 1–20 unique choices.");
    if (
      typeof (field.placeholder ?? "") !== "string" ||
      (field.placeholder || "").length > 160
    )
      fail("Field placeholders must be short text.");
    return {
      key: field.key,
      label: field.label.trim(),
      type: field.type,
      required: field.required === true,
      placeholder: field.placeholder || "",
      options: field.type === "select" ? options : [],
    };
  });
  return {
    enabled: clean.enabled === true,
    title: clean.title,
    description: clean.description,
    submitLabel: clean.submitLabel,
    successMessage: clean.successMessage,
    notify: clean.notify === true,
    recipient: clean.recipient,
    fields: clean.fields,
  };
}
export function validateSubmission(fields, values) {
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    Object.keys(values).some(
      (key) => !fields.some((field) => field.key === key),
    )
  )
    fail("Check the submitted form fields.");
  const entries = fields.map((field) => {
    const raw = values[field.key];
    if (field.type === "checkbox") {
      if (raw !== undefined && typeof raw !== "boolean")
        fail("Check " + field.label + ".");
      if (field.required && raw !== true) fail(field.label + " is required.");
      return { ...field, value: raw === true ? "Yes" : "No" };
    }
    if (raw !== undefined && typeof raw !== "string")
      fail("Check " + field.label + ".");
    const value = (raw || "").trim();
    if (field.required && !value) fail(field.label + " is required.");
    if (
      value.length > (field.type === "textarea" ? 5000 : 1000) ||
      /\0/.test(value)
    )
      fail(field.label + " is too long or invalid.");
    if (value && field.type === "email") mailAddress(value);
    if (value && field.type === "number" && !Number.isFinite(Number(value)))
      fail("Enter a valid number for " + field.label + ".");
    if (value && field.type === "select" && !field.options.includes(value))
      fail("Choose an available option for " + field.label + ".");
    if (value && field.type === "url") {
      try {
        if (!["https:", "http:"].includes(new URL(value).protocol)) throw 0;
      } catch {
        fail("Enter a valid website URL for " + field.label + ".");
      }
    }
    return { ...field, value };
  });
  if (JSON.stringify(entries).length > 25000) fail("The message is too large.");
  return entries;
}
export const formHash = async (fields) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(fields)),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
