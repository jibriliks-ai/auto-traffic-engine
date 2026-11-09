import QRCode from "qrcode";
import fs from "fs/promises";

export async function generateQRFile(
  url: string,
  outputPath: string
): Promise<string> {
  const buffer = await QRCode.toBuffer(url, {
    width: 400,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
    errorCorrectionLevel: "M",
    type: "png",
  });
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

