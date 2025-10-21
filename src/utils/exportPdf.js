// src/utils/exportPdf.js
import html2pdf from "html2pdf.js";

export default async function exportPdf(rootEl, filename) {
  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: window.devicePixelRatio || 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css"] },
  };
  await html2pdf().set(opt).from(rootEl).save();
}