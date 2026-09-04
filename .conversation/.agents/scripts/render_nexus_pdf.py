from pathlib import Path
import fitz

pdf_path = Path("attached_assets/Nexus_Pathways_AI_Replit_Build_Plan_1788542835819.pdf")
out_dir = Path(".agents/outputs/nexus_pdf_pages")
out_dir.mkdir(parents=True, exist_ok=True)

doc = fitz.open(pdf_path)
print(f"pages={doc.page_count}")
print(f"metadata={doc.metadata}")

for index, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    output = out_dir / f"page-{index + 1:02d}.png"
    pix.save(output)
    print(f"rendered={output} size={pix.width}x{pix.height}")

    text = page.get_text("text")
    print(f"page={index + 1} text_chars={len(text)}")