import { fail } from "../../server/v2-utils.mjs";
export const LAZY_LOAD_ID = "com.colossal.lazy-load";
export const defaults = Object.freeze({
  enabled: true,
  spinnerColor: "#56df95",
  spinnerSize: 28,
  skipFirstImage: true,
});
export function validateSettings(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.enabled !== "boolean" ||
    typeof value.skipFirstImage !== "boolean" ||
    !/^#[a-f0-9]{6}$/i.test(value.spinnerColor || "") ||
    !Number.isInteger(value.spinnerSize) ||
    value.spinnerSize < 16 ||
    value.spinnerSize > 64
  )
    fail("Choose a spinner color and a size between 16 and 64 pixels.");
  return {
    enabled: value.enabled,
    spinnerColor: value.spinnerColor,
    spinnerSize: value.spinnerSize,
    skipFirstImage: value.skipFirstImage,
  };
}
