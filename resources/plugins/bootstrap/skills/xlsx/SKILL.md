---
name: xlsx
description: Create, read, edit and analyse spreadsheets (.xlsx, .xlsm, .csv, legacy .xls) while keeping formulas live. Use when the user asks to build a spreadsheet, budget, tracker or financial model, to summarise, clean, filter, pivot or chart tabular data, to add or fix formulas, columns or formatting in an existing workbook, or to convert between CSV and Excel.
license: MIT
---

# Spreadsheets

Use `pandas` to analyse data and `openpyxl` to build or change workbooks. The rule that matters most: a spreadsheet you deliver must calculate. Write formulas into cells, not numbers you computed in Python, so the workbook updates when the user changes an input. Run everything through `bash`.

## Choose the tool

| Task | Tool |
| --- | --- |
| Explore, summarise, filter, pivot, join data | `pandas` |
| Read or write CSV | `pandas` |
| Create a workbook with formulas and formatting | `openpyxl` |
| Edit an existing workbook and keep its formulas and styles | `openpyxl` (never a pandas round trip) |
| Get the computed values of formulas | LibreOffice recalculation, then `data_only=True` |
| Convert `.xls` to `.xlsx` | `soffice --headless --convert-to xlsx` |
| Show the user a quick chart of the data | the `chart` script through `run_script` |
| Put a chart inside the workbook | `openpyxl.chart` |

## Prerequisites

```bash
command -v python3 || command -v py
python3 -c "import openpyxl, pandas; print('ok')"
command -v soffice || ls /Applications/LibreOffice.app/Contents/MacOS/soffice
```

If something is missing, tell the user what and the install command, then use `ask` for their go-ahead before installing:

- Python packages, in a virtual environment: `python3 -m venv .venv && .venv/bin/pip install openpyxl pandas` (Windows: `py -3 -m venv .venv`, then `.venv\Scripts\pip install openpyxl pandas`). Run scripts with `.venv/bin/python`.
- LibreOffice (needed only to recalculate or convert): `brew install --cask libreoffice`, `winget install TheDocumentFoundation.LibreOffice`, or `sudo apt install libreoffice`. On macOS call `/Applications/LibreOffice.app/Contents/MacOS/soffice` when it is not on `PATH`.

## Read and analyse

```python
import pandas as pd

sheets = pd.read_excel("sales.xlsx", sheet_name=None)      # dict of sheet name -> DataFrame
for name, df in sheets.items():
    print(name, df.shape)
df = sheets["Orders"]
print(df.head(), df.dtypes, df.describe(include="all"), sep="\n\n")

by_region = df.groupby("Region", as_index=False)["Amount"].sum()
pivot = df.pivot_table(index="Region", columns="Quarter", values="Amount", aggfunc="sum", fill_value=0)

csv = pd.read_csv("export.csv", sep=None, engine="python", encoding="utf-8-sig", dtype=str)
```

`sep=None` with the Python engine detects `,` `;` or tab. `dtype=str` keeps leading zeros in codes and phone numbers; convert the numeric columns afterwards with `pd.to_numeric`. pandas reads the values a formula last produced, not the formula.

To see formulas and layout, open the workbook with openpyxl:

```python
from openpyxl import load_workbook

wb = load_workbook("model.xlsx")                 # formulas come back as strings such as "=SUM(B2:B9)"
for ws in wb:
    print(ws.title, ws.dimensions)
    for row in ws.iter_rows(min_row=1, max_row=15):
        for c in row:
            if c.value is not None:
                print(c.coordinate, repr(c.value))
```

## Create

```python
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Font, PatternFill

wb = Workbook()
ws = wb.active
ws.title = "Budget"
ws.append(["Item", "Qty", "Unit price", "Total"])
for item, qty, price in [("Laptops", 4, 1150.0), ("Monitors", 6, 240.0), ("Docks", 4, 129.5)]:
    ws.append([item, qty, price])
last = ws.max_row
for r in range(2, last + 1):
    ws[f"D{r}"] = f"=B{r}*C{r}"
ws[f"A{last + 1}"] = "Total"
ws[f"D{last + 1}"] = f"=SUM(D2:D{last})"

for c in ws[1]:
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="1F4E78")
    c.alignment = Alignment(horizontal="center")
for r in range(2, last + 2):
    ws[f"C{r}"].number_format = ws[f"D{r}"].number_format = "#,##0.00"
ws.column_dimensions["A"].width = 24
ws.freeze_panes = "A2"

chart = BarChart()
chart.title = "Cost by item"
chart.add_data(Reference(ws, min_col=4, min_row=1, max_row=last), titles_from_data=True)
chart.set_categories(Reference(ws, min_col=1, min_row=2, max_row=last))
ws.add_chart(chart, "F2")
wb.save("budget.xlsx")
```

Keep inputs (rates, prices, assumptions) in their own labelled cells and point formulas at them (`=B5*$B$1`) instead of typing the number into each formula. To write a DataFrame as a plain data sheet, `df.to_excel("out.xlsx", index=False)` is enough.

## Edit an existing workbook

```python
from openpyxl import load_workbook

wb = load_workbook("model.xlsx")                 # add keep_vba=True for .xlsm, and save as .xlsm
ws = wb["Budget"]
ws["C3"] = 255.0                                 # change an input; formulas stay as they are
ws.append(["Cables", 10, 12.0, f"=B{ws.max_row + 1}*C{ws.max_row + 1}"])
wb.save("model-edited.xlsx")
```

Match what is already there: copy the number format and font of the neighbouring cells for anything you add, and keep the sheet's existing conventions.

## Recalculate and check formulas

openpyxl stores a formula as text and never computes it. A file it just saved holds no results until a spreadsheet application opens it. Recalculate into a separate folder with LibreOffice, then read the values:

```bash
soffice --headless --convert-to xlsx --outdir recalculated budget.xlsx
```

```python
from openpyxl import load_workbook

formulas = load_workbook("budget.xlsx")
values = load_workbook("recalculated/budget.xlsx", data_only=True)
for ws in formulas:
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and c.value.startswith("="):
                v = values[ws.title][c.coordinate].value
                if v is None or (isinstance(v, str) and v.startswith("#")):
                    print(f"{ws.title}!{c.coordinate} {c.value} -> {v!r}")
```

Anything printed is a formula that produced no value or an error (`#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`). Fix it and repeat until the output is empty. Deliver the file you wrote with openpyxl; hand over the recalculated copy instead only when the user needs stored results, for example for a previewer or another program that does not calculate.

## Verify

1. Reopen the saved file with `load_workbook` and print the sheet names, dimensions and a sample of cells.
2. Run the recalculation check above whenever the workbook contains formulas. If LibreOffice is unavailable and the user declines to install it, say that the formulas were not evaluated.
3. Sanity-check key results independently: compute the main totals with pandas from the raw data and compare them with the recalculated cells.
4. For an analysis, state the row counts before and after each filter or join so that dropped or duplicated rows are visible.

## Pitfalls

- `load_workbook(path, data_only=True)` followed by `save` replaces every formula with its last value, permanently. Use `data_only=True` for reading only and never save that workbook object.
- A pandas round trip (`read_excel` then `to_excel`) discards formulas, formatting, column widths, charts and the other sheets. Use it for new data sheets, not for editing.
- openpyxl keeps only what it understands. Saving can drop charts, images, shapes and other embedded objects it could not read from the original. Compare the result with the source, tell the user about anything lost, and keep the original untouched.
- Write formulas with English function names and comma separators (`=SUM(A1:A9)`, `=IF(A1>0,"y","n")`) whatever the user's locale. Functions newer than Excel 2010 need a prefix or show `#NAME?`: `=_xlfn.XLOOKUP(...)`, `=_xlfn.IFS(...)`. Prefer `INDEX`/`MATCH` and `SUMIFS`, which work everywhere.
- `insert_rows`, `delete_rows` and their column equivalents do not adjust formulas, charts or named ranges that refer to the moved cells. Append at the end where you can, otherwise rewrite the affected formulas.
- Rows and columns are numbered from 1: `ws.cell(row=1, column=1)` is `A1`.
- Write numbers and dates as Python numbers and `datetime` objects, not strings, and control display with `number_format` (`"0.0%"`, `"yyyy-mm-dd"`). A number stored as text will not sum.
- `ws.max_row` counts rows that only carry formatting. Find the last real row by checking a key column for values.
- CSV has no types, formulas or formatting. Write with `df.to_csv("out.csv", index=False)`, and add `encoding="utf-8-sig"` when the file is meant for Excel on Windows so accented characters survive.
- Very large sheets: `load_workbook(path, read_only=True)` to scan, `Workbook(write_only=True)` to write, or stay in pandas.
- Save under a new name next to the input. Never overwrite the user's workbook unless they asked for that.
