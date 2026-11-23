/**
 * Converts a string to a URL-friendly slug.
 * @param text - The text to slugify
 * @returns The slugified string
 */
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

/**
 * Validates an Indian 10-digit mobile number.
 * - Must be a 10-digit number (or +91 prefixed)
 * - Must start with 6, 7, 8, or 9
 * - Rejects repeating dummy digits (e.g. 7777777777, 9999999999, 0000000000)
 * - Rejects sequential dummy numbers (e.g. 1234567890, 0123456789)
 */
export const validateIndianMobile = (phone: string): { isValid: boolean; error?: string } => {
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return { isValid: false, error: "Please enter your mobile number" };
  }
  const clean = phone.replace(/\D/g, "").slice(-10);
  if (clean.length !== 10) {
    return { isValid: false, error: "Mobile number must be exactly 10 digits" };
  }
  if (!/^[6-9]/.test(clean)) {
    return { isValid: false, error: "Indian mobile numbers must start with 6, 7, 8, or 9" };
  }
  if (/^(\d)\1{9}$/.test(clean)) {
    return { isValid: false, error: "Repeating dummy numbers (like " + clean + ") are not accepted" };
  }
  if (clean === "1234567890" || clean === "0123456789") {
    return { isValid: false, error: "Sequential dummy numbers are not accepted" };
  }
  return { isValid: true };
};
