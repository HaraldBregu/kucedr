---
name: pptx
description: Create, read and edit PowerPoint presentations (.pptx, legacy .ppt). Use when the user asks for a slide deck or pitch, wants the text or speaker notes pulled out of a presentation, wants slides added, removed, reordered or reworded in an existing deck, wants a deck built on their own template, or wants a presentation converted to PDF or images.
license: MIT
---

# PowerPoint presentations

Use `python-pptx` to read, build and edit `.pptx` files, and LibreOffice to render them. python-pptx never renders a slide, so it cannot tell you whether text fits: every deck you produce must go through the verification step below. Run everything through `bash`.

## Choose the tool

| Task | Tool |
| --- | --- |
| Read slide text, tables and speaker notes | `python-pptx` |
| Create a deck from scratch | `python-pptx` with the default template |
| Create a deck in the user's branding | `python-pptx` opening their `.pptx` as the template |
| Change text, add, delete or reorder slides | `python-pptx` |
| Convert `.ppt` to `.pptx`, or a deck to PDF | `soffice --headless --convert-to` |
| Look at the rendered slides | `soffice` to PDF, then `pdftoppm -png` |

## Prerequisites

```bash
command -v python3 || command -v py
python3 -c "import pptx; print('python-pptx ok')"
command -v soffice || ls /Applications/LibreOffice.app/Contents/MacOS/soffice
command -v pdftoppm
```

If something is missing, tell the user what and the install command, then use `ask` for their go-ahead before installing:

- python-pptx, in a virtual environment: `python3 -m venv .venv && .venv/bin/pip install python-pptx` (Windows: `py -3 -m venv .venv`, then `.venv\Scripts\pip install python-pptx`). Run scripts with `.venv/bin/python`.
- LibreOffice: `brew install --cask libreoffice`, `winget install TheDocumentFoundation.LibreOffice`, or `sudo apt install libreoffice`. On macOS call `/Applications/LibreOffice.app/Contents/MacOS/soffice` when it is not on `PATH`.
- pdftoppm: `brew install poppler` or `sudo apt install poppler-utils`.

## Read

```python
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

def walk(shapes):
    for sh in shapes:
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from walk(sh.shapes)
        else:
            yield sh

prs = Presentation("deck.pptx")
for n, slide in enumerate(prs.slides, start=1):
    print(f"--- slide {n} ({slide.slide_layout.name}) ---")
    for sh in walk(slide.shapes):
        if sh.has_text_frame and sh.text_frame.text.strip():
            print(f"[{sh.name}] {sh.text_frame.text}")
        if sh.has_table:
            for row in sh.table.rows:
                print(" | ".join(c.text for c in row.cells))
    if slide.has_notes_slide:
        print("notes:", slide.notes_slide.notes_text_frame.text)
```

## Create

```python
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches, Pt

prs = Presentation()                        # default template is 4:3
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)   # 16:9

slide = prs.slides.add_slide(prs.slide_layouts[0])                # title slide
slide.shapes.title.text = "Quarterly review"
slide.placeholders[1].text = "Q2 results"

slide = prs.slides.add_slide(prs.slide_layouts[5])                # title only
slide.shapes.title.text = "Revenue grew 12%"
box = slide.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(5.5), Inches(4.5))
tf = box.text_frame
tf.word_wrap = True
for i, line in enumerate(["North up 15%", "South flat", "Two new accounts"]):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.text = line
    p.font.size = Pt(20)
    p.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

data = CategoryChartData()
data.categories = ["Q1", "Q2"]
data.add_series("North", (120, 135))
data.add_series("South", (98, 101))
slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED,
                       Inches(6.8), Inches(1.6), Inches(5.8), Inches(4.5), data)

slide.shapes.add_picture("logo.png", Inches(11.8), Inches(0.3), width=Inches(1))
slide.notes_slide.notes_text_frame.text = "Mention the two new accounts."
prs.save("quarterly-review.pptx")
```

More building blocks:

- Table: `t = slide.shapes.add_table(rows, cols, left, top, width, height).table`, then `t.cell(r, c).text = "..."`.
- Bullets in a content placeholder (layout 1): `tf = slide.placeholders[1].text_frame`, then `p = tf.add_paragraph(); p.text = "..."; p.level = 1` for a sub-point.
- Shape: `slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)` from `pptx.enum.shapes`; colour it with `shape.fill.solid(); shape.fill.fore_color.rgb = RGBColor(...)`.
- Charts built with `add_chart` stay editable in PowerPoint. Prefer them to pasted chart images.

After changing the slide size of the default template, its placeholders keep their 4:3 positions. On widened slides either position your own text boxes as above or use a 16:9 template.

## Build on the user's template

```python
prs = Presentation("brand-template.pptx")
for i, layout in enumerate(prs.slide_layouts):
    print(i, layout.name, [(ph.placeholder_format.idx, ph.placeholder_format.type, ph.name)
                           for ph in layout.placeholders])
```

Pick layouts by name, not by index, and fill placeholders by the `idx` printed above (`slide.placeholders[idx]` is keyed by that number, not by position). Layout numbering and placeholder ids differ in every template.

## Edit an existing deck

```python
prs = Presentation("deck.pptx")

for slide in prs.slides:                    # reword while keeping formatting
    for sh in slide.shapes:
        if not sh.has_text_frame:
            continue
        for p in sh.text_frame.paragraphs:
            for r in p.runs:
                r.text = r.text.replace("2024", "2025")

ids = prs.slides._sldIdLst                  # no public API for delete or reorder
gone = ids[2]                               # delete the third slide
prs.part.drop_rel(gone.rId)
ids.remove(gone)
moved = ids[4]                              # move the fifth slide to the front
ids.remove(moved)
ids.insert(0, moved)

prs.save("deck-edited.pptx")
```

Formatting lives on runs. Assigning `text_frame.text` or `paragraph.text` rebuilds the runs and drops per-run formatting, so change `run.text` when the look must survive. A phrase can be split across runs; when a replacement does not match, print the runs and edit the ones involved.

## Verify

1. Reopen the file and check slide count and titles: `python3 -c "from pptx import Presentation; p = Presentation('out.pptx'); print(len(p.slides))"`.
2. Check that nothing sits outside the slide:

```python
for n, slide in enumerate(prs.slides, start=1):
    for sh in slide.shapes:
        if sh.left is None or sh.width is None:
            continue                        # placeholder inheriting its position from the layout
        if sh.left < 0 or sh.top < 0 or sh.left + sh.width > prs.slide_width \
                or sh.top + sh.height > prs.slide_height:
            print(f"slide {n}: '{sh.name}' is off the slide")
```

3. Render and look. This is the only way to catch overflowing text and overlapping shapes:

```bash
soffice --headless --convert-to pdf --outdir render out.pptx
pdftoppm -png -r 50 render/out.pdf render/slide      # render/slide-1.png, slide-2.png, ...
```

Open the images with `read`, or give the user the paths. Fix what you find and render again. If LibreOffice is not available and the user declines to install it, say plainly that the layout was not visually checked.

## Pitfalls

- Text overflow: a text box does not grow or shrink its text when written by python-pptx. Setting `text_frame.auto_size` only records the preference; PowerPoint applies it when the text is next edited. Size text explicitly and budget it: roughly 6 bullets of up to 10 words at 20 pt in a half-width box, a title of one line. Split a crowded slide in two.
- Set `text_frame.word_wrap = True` on every text box you add, or long lines run off the slide.
- Positions and sizes are EMU integers. Always go through `Inches()`, `Cm()` or `Pt()` from `pptx.util`, and use integer division when you compute with them.
- `Presentation()` gives the plain default theme at 4:3. Set the 16:9 size before adding slides.
- An empty placeholder you leave on a slide shows "Click to add text" in the editor. Remove unused ones with `ph._element.getparent().remove(ph._element)`, or pick a layout without them.
- python-pptx cannot duplicate a slide, and it does not create or edit animations, transitions or SmartArt. Existing ones are kept when you save, except on slides you delete.
- Fonts that are not installed are substituted in the LibreOffice render, which shifts line breaks. Treat a near miss in the render as an overflow.
- python-pptx opens `.pptx` only. Convert `.ppt` first: `soffice --headless --convert-to pptx --outdir out old.ppt`.
- Save under a new name next to the input. Never overwrite the user's deck unless they asked for that.
