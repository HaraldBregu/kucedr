---
name: pdf
description: Work with PDF files - extract text and tables, create new PDFs, merge, split, reorder and rotate pages, encrypt or decrypt, and fill PDF forms. Use when the user asks to read, summarise or pull data out of a PDF, to generate a PDF report, invoice or letter, to combine or cut up PDFs, or to complete a fillable or flat PDF form.
license: MIT
---

# PDF files

A PDF describes fixed pages, not flowing text. Reading is extraction, and "editing" is page-level work (merge, split, rotate, overlay, form fields). To change the wording of a PDF, edit the source document and export again. Run everything through `bash`.

## Choose the tool

| Task | Tool |
| --- | --- |
| Extract text quickly | `pdftotext -layout` (poppler), else `pypdf` |
| Extract tables, or text from a region of a page | `pdfplumber` |
| Merge, split, reorder, rotate, encrypt, decrypt | `pypdf`, or `qpdf` on the command line |
| Create a PDF from data or text | `reportlab` |
| Create a PDF from an existing .docx, .pptx, .xlsx or .html | `soffice --headless --convert-to pdf` |
| Fill a fillable form (AcroForm) | `pypdf` |
| Fill a flat form with no fields | `reportlab` overlay merged with `pypdf` |
| Render pages to images to look at them | `pdftoppm -png` (poppler) |

## Prerequisites

Check only what the task needs:

```bash
command -v python3 || command -v py
command -v pdftotext pdftoppm qpdf
python3 -c "import pypdf, pdfplumber, reportlab; print('ok')"
```

If something is missing, tell the user what and the install command, then use `ask` for their go-ahead before installing:

- Python packages, in a virtual environment: `python3 -m venv .venv && .venv/bin/pip install pypdf pdfplumber reportlab` (Windows: `py -3 -m venv .venv`, then `.venv\Scripts\pip install ...`). Run scripts with `.venv/bin/python`.
- poppler and qpdf: `brew install poppler qpdf` or `sudo apt install poppler-utils qpdf`. On Windows prefer the Python route, which covers everything except rendering.

## Extract text and tables

```bash
pdftotext -layout report.pdf report.txt          # whole document, columns kept aligned
pdftotext -f 3 -l 5 -layout report.pdf part.txt  # pages 3 to 5
```

```python
import pdfplumber

with pdfplumber.open("report.pdf") as pdf:
    for n, page in enumerate(pdf.pages, start=1):
        text = page.extract_text() or ""
        print(f"--- page {n} ---\n{text}")
        for table in page.extract_tables():      # list of rows, each a list of str or None
            for row in table:
                print(row)
```

If the text comes back empty or nearly empty, the pages are scanned images. Extraction cannot help; the file needs OCR (`ocrmypdf in.pdf out.pdf`, or `tesseract` on rendered page images). Tell the user and `ask` before installing an OCR tool.

## Merge, split, rotate, protect

```python
from pypdf import PdfReader, PdfWriter

writer = PdfWriter()                              # merge
for path in ["a.pdf", "b.pdf"]:
    writer.append(path)
writer.write("merged.pdf")

reader = PdfReader("merged.pdf")                  # split: pages 1-3, zero-based indexes
writer = PdfWriter()
for page in reader.pages[0:3]:
    writer.add_page(page)
writer.write("first-three.pdf")

writer = PdfWriter()                              # rotate page 1 by 90 degrees clockwise
for i, page in enumerate(reader.pages):
    if i == 0:
        page.rotate(90)                           # multiples of 90 only
    writer.add_page(page)
writer.write("rotated.pdf")

reader = PdfReader("locked.pdf")                  # decrypt, then encrypt with a new password
if reader.is_encrypted:
    reader.decrypt("old-password")
writer = PdfWriter()
writer.append(reader)
writer.encrypt("new-password")
writer.write("relocked.pdf")
```

The same with qpdf, where page numbers are one-based:

```bash
qpdf --empty --pages a.pdf b.pdf -- merged.pdf
qpdf in.pdf --pages . 1-3 -- first-three.pdf
qpdf in.pdf rotated.pdf --rotate=+90:1
qpdf --decrypt --password=secret locked.pdf unlocked.pdf
```

Only remove a password the user gave you. Do not try to guess or break one.

## Create

```python
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

styles = getSampleStyleSheet()
doc = SimpleDocTemplate("summary.pdf", pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm)
table = Table([["Region", "Q1", "Q2"], ["North", "120", "135"], ["South", "98", "101"]], repeatRows=1)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
]))
doc.build([
    Paragraph("Quarterly summary", styles["Title"]),
    Paragraph("Revenue grew by <b>12%</b> year on year.", styles["BodyText"]),
    Spacer(1, 0.5 * cm),
    table,
])
```

`SimpleDocTemplate` flows content over pages for you. For long prose that already exists as a document, converting it with `soffice` is simpler than rebuilding it in reportlab.

## Fill forms

First find out which kind of form it is:

```python
from pypdf import PdfReader

fields = PdfReader("form.pdf").get_fields() or {}
for name, f in fields.items():
    print(name, f.get("/FT"), f.get("/V"), f.get("/_States_", ""))
```

`/FT` is `/Tx` (text), `/Btn` (checkbox or radio) or `/Ch` (choice). No fields printed means a flat form.

Fillable form - set values by field name. Checkboxes and radios take one of the names listed in `/_States_` (often `/Yes`, with `/Off` for unchecked), not `True`:

```python
from pypdf import PdfReader, PdfWriter

writer = PdfWriter()
writer.append(PdfReader("form.pdf"))              # append keeps the form definition
values = {"full_name": "Ada Lovelace", "agree": "/Yes"}
for page in writer.pages:
    writer.update_page_form_field_values(page, values, auto_regenerate=False)
writer.set_need_appearances_writer(True)          # ask viewers to draw the new values
writer.write("form-filled.pdf")
```

Flat form - draw the text on a transparent page of the same size and merge it over the original:

```python
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

reader = PdfReader("flat.pdf")
box = reader.pages[0].mediabox
c = canvas.Canvas("overlay.pdf", pagesize=(float(box.width), float(box.height)))
c.setFont("Helvetica", 10)
c.drawString(150, 640, "Ada Lovelace")            # x, y in points from the bottom-left corner
c.save()

writer = PdfWriter()
writer.append(reader)
writer.pages[0].merge_page(PdfReader("overlay.pdf").pages[0])
writer.write("flat-filled.pdf")
```

Find the coordinates with pdfplumber: `page.extract_words()` returns each label with `x0`, `x1`, `top`, `bottom`. pdfplumber measures `top` from the top of the page, reportlab measures `y` from the bottom, so `y = page.height - bottom`. If the user did not supply every value the form asks for, `ask` rather than invent one.

## Verify

1. Reopen the result and check the page count: `python3 -c "from pypdf import PdfReader; print(len(PdfReader('out.pdf').pages))"`. `qpdf --check out.pdf` reports structural damage.
2. For anything visual (a created PDF, an overlay, a filled form), render and look: `pdftoppm -png -r 80 out.pdf page` writes `page-1.png`, `page-2.png`, and so on. Open them with `read`, or give the user the paths. Check that text sits inside its boxes and that nothing is cut off at the margins.
3. For a filled form, read the values back with `get_fields()` and compare them with what you were given.
4. For extraction, compare a sample of the numbers against the rendered page before you rely on them.

## Pitfalls

- Extracted text follows the order in which it was drawn, which is not always reading order. Multi-column pages interleave. Use `pdftotext -layout`, or crop each column with pdfplumber (`page.crop((x0, top, x1, bottom))`).
- `extract_tables()` relies on ruling lines by default. For tables without lines pass `table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"}` and check the result. Merged cells come back as `None`.
- reportlab `Paragraph` text is markup: escape `&`, `<` and `>` in user data (`xml.sax.saxutils.escape`). The built-in fonts (Helvetica, Times-Roman, Courier) cover Western European characters only. For other scripts register a TrueType font with `pdfmetrics.registerFont(TTFont("Name", "/path/font.ttf"))` and use that name, or you get black boxes.
- `page.rotate()` adds to any existing rotation. Read `page.rotation` first if the user wants a specific final orientation.
- Some viewers ignore the need-appearances flag and show filled fields as blank until clicked. Render the result to confirm, and mention it if the render is empty while `get_fields()` holds the values.
- Building a writer with `add_page` alone drops the form definition, bookmarks and other document-level data. Use `writer.append(reader)` when those must survive.
- Signed PDFs: any change invalidates the signature. Warn the user first.
- Write results under a new name next to the input. Never overwrite the original unless the user asked for that.
