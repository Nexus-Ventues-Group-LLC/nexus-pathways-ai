from pathlib import Path
import fitz

pdf_path = Path("attached_assets/Nexus_Pathways_AI_Replit_Build_Plan_1788542835819.pdf")
output_path = Path(".agents/outputs/nexus_build_plan.txt")

doc = fitz.open(pdf_path)
with output_path.open("w", encoding="utf-8") as out:
    for index, page in enumerate(doc, start=1):
        out.write(f"\n\n===== PAGE {index} =====\n\n")
        out.write(doc[index - 1].get_text("text"))

print(f"wrote={output_path} pages={doc.page_count} bytes={output_path.stat().st_size}")