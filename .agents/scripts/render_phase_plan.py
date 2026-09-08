from pathlib import Path

import fitz


pdf_path = Path(
    ".local/conversation-workspace/files/attached_assets/"
    "Nexus_Pathways_AI_Replit_Build_Plan_1788542835819.pdf"
)
output_dir = Path(".agents/outputs/phase-plan")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
(output_dir / "full-text.txt").write_text(
    "\n\n".join(
        f"--- PAGE {index + 1} ---\n{page.get_text()}"
        for index, page in enumerate(document)
    ),
    encoding="utf-8",
)

for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pixmap.save(output_dir / f"page-{index + 1:02d}.png")

print(f"Rendered {document.page_count} pages to {output_dir}")