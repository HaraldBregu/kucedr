---
name: docx
description: Create, read and edit Word documents (.docx, legacy .doc). Use when the user asks to write a report, letter, memo or other document as a Word file, to extract or summarise the text of a .docx, to change text, tables, images, headers or styles in an existing document, to fill a Word template, or to convert between .docx and Markdown, HTML or PDF.
license: MIT
---

# Word documents

A `.docx` is a zip of XML parts. Work on it with `python-docx` (structure-aware create and edit), `pandoc` (text in and out) and LibreOffice (PDF and legacy formats). Run everything through `bash`.

## Choose the tool

| Task | Tool |
| --- | --- |
| Read the text, headings and tables | `pandoc file.docx -t gfm` |
| Read tracked changes and comments | `pandoc --track-changes=all` |
| Create a document with layout control (tables, images, styles) | `python-docx` |
| Create a plain document from Markdown you already have | `pandoc in.md -o out.docx` |
| Edit an existing document and keep its formatting | `python-docx`, run-level edits |
| Fill a template the user supplied | `python-docx` on a copy of the template |
| Convert `.doc` to `.docx`, or `.docx` to PDF | `soffice --headless --convert-to` |

## Prerequisites

Check before you start, and only for the tools the task needs:

```bash
command -v python3 || command -v py        # Windows often has only `py`
command -v pandoc
command -v soffice || ls /Applications/LibreOffice.app/Contents/MacOS/soffice
python3 -c "import docx; print('python-docx ok')"
```

On Windows `soffice.exe` is usually in `C:\Program Files\LibreOffice\program\`. On macOS call it by the full path above when it is not on `PATH`.

If something is missing, do not install silently. Tell the user what is missing and the command, then use `ask` to get their go-ahead:

- python-docx, in a virtual environment: `python3 -m venv .venv && .venv/bin/pip install python-docx` (Windows: `py -3 -m venv .venv` then `.venv\Scripts\pip install python-docx`). Afterwards run scripts with `.venv/bin/python`.
- pandoc: `brew install pandoc`, `winget install JohnMacFarlane.Pandoc`, or `sudo apt install pandoc`.
- LibreOffice: `brew install --cask libreoffice`, `winget install TheDocumentFoundation.LibreOffice`, or `sudo apt install libreoffice`.

## Read

```bash
pandoc report.docx -t gfm -o report.md                       # text, headings, lists, tables
pandoc report.docx -t gfm --track-changes=all -o review.md   # keeps insertions, deletions, comments
pandoc report.docx -t gfm --extract-media=media -o report.md # also writes embedded images to media/
```

Then open the Markdown with `read`. Without pandoc, use python-docx:

```python
from docx import Document

doc = Document("report.docx")
for p in doc.paragraphs:
    if p.text.strip():
        print(f"[{p.style.name}] {p.text}")
for t in doc.tables:
    for row in t.rows:
        print(" | ".join(c.text.strip() for c in row.cells))
```

`doc.paragraphs` covers the body only. Text in tables is under `doc.tables`, and headers and footers are under `doc.sections[i].header.paragraphs` and `.footer.paragraphs`.

## Create

Write the script with `write`, then run it with `bash`.

```python
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt

doc = Document()
doc.styles["Normal"].font.name = "Calibri"
doc.styles["Normal"].font.size = Pt(11)
for s in doc.sections:
    s.left_margin = s.right_margin = Cm(2.5)

doc.add_heading("Quarterly report", level=0)          # level 0 = Title, 1-9 = Heading n
p = doc.add_paragraph("Revenue grew by ")
p.add_run("12%").bold = True
p.add_run(" year on year.")
doc.add_paragraph("First point", style="List Bullet")
doc.add_paragraph("Step one", style="List Number")

table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
for cell, text in zip(table.rows[0].cells, ["Region", "Q1", "Q2"]):
    cell.text = text
for region, q1, q2 in [("North", 120, 135), ("South", 98, 101)]:
    cells = table.add_row().cells
    cells[0].text, cells[1].text, cells[2].text = region, str(q1), str(q2)

doc.add_picture("chart.png", width=Cm(14))
doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
doc.add_page_break()
doc.sections[0].footer.paragraphs[0].text = "Confidential"
doc.save("quarterly-report.docx")
```

Use real heading and list styles rather than bold text and typed bullets or numbers, so the outline, navigation and a later table of contents work.

## Edit an existing document

Open, change, save under a new name. A paragraph's text is split into runs, and each run carries its own formatting, so edit at run level.

```python
from docx import Document

def paragraphs(doc):
    yield from doc.paragraphs
    for t in doc.tables:
        for row in t.rows:
            for cell in row.cells:
                yield from cell.paragraphs
    for s in doc.sections:
        yield from s.header.paragraphs
        yield from s.footer.paragraphs

doc = Document("contract.docx")
old, new = "{{client}}", "Acme Ltd"
for p in paragraphs(doc):
    if old not in p.text:
        continue
    for r in p.runs:
        if old in r.text:
            r.text = r.text.replace(old, new)
    if old in p.text:                       # the match spans several runs
        p.runs[0].text = p.text.replace(old, new)
        for r in p.runs[1:]:
            r.text = ""
doc.save("contract-filled.docx")
```

Other edits:

- Insert before a paragraph: `p.insert_paragraph_before("text", style="Normal")`.
- Delete a paragraph: `p._element.getparent().remove(p._element)` (python-docx has no public method).
- Restyle: `p.style = doc.styles["Heading 2"]`; `run.font.bold`, `.italic`, `.size`, `.color.rgb`.
- Table cell: `table.cell(row, col).text = "..."`; add rows with `table.add_row()`.

## Convert

```bash
soffice --headless --convert-to docx --outdir out legacy.doc
soffice --headless --convert-to pdf  --outdir out report.docx
pandoc notes.md -o notes.docx
pandoc notes.md --reference-doc=house-style.docx -o notes.docx   # borrow styles from a document
```

`--outdir` keeps the result away from the source file. LibreOffice writes `out/<same name>.<new extension>`.

## Verify

Never report a document as done without checking it.

1. Reopen it: `python3 -c "from docx import Document; d = Document('out.docx'); print(len(d.paragraphs), len(d.tables))"`. A file that fails to open here will not open in Word.
2. Read the text back with `pandoc out.docx -t gfm` and confirm that the content, the heading order and the table contents are what you intended, and that no placeholder such as `{{...}}` is left.
3. When layout matters (page breaks, wide tables, images), convert to PDF with `soffice` and inspect the pages, or tell the user which pages to look at. LibreOffice rendering is close to Word but not identical, especially for fonts that are not installed.

## Pitfalls

- Tracked changes: python-docx does not read or write revisions. Text inside a tracked insertion is missing from `paragraph.text`, and your edits are saved as plain changes, not as revisions. If the document has tracked changes or the user wants their edits tracked, say so and `ask` how to proceed (for example accept all changes in Word first).
- Assigning `paragraph.text = ...` replaces every run and drops character formatting inside that paragraph. Use it only when the paragraph is uniformly formatted.
- Styles are looked up by their English built-in name (`"Heading 1"`, `"List Bullet"`, `"Table Grid"`) and must exist in the file. A user's template may not define them, which raises `KeyError`. List what is available with `[s.name for s in doc.styles]`.
- Merged table cells appear more than once in `row.cells`. Deduplicate before counting or writing.
- A table of contents, page numbers and other fields are computed by Word, not by python-docx. An existing table of contents is stale after your edit until the user updates fields in Word (select all, F9).
- `add_picture` takes PNG, JPEG and similar raster formats. Convert SVG to PNG first.
- python-docx opens `.docx` only. Convert `.doc`, `.rtf` and `.odt` with `soffice` first.
- Do not overwrite the user's file. Save next to it under a new name (`report-edited.docx`) unless the user asked you to replace it.
