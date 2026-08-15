export async function createPreviewUrl(file: File): Promise<string | null> {
  if (/\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif") {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.85,
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("HEIC client conversion for preview failed:", e);
    }
  }

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }
  return null;
}
