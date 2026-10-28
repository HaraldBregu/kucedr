# organui

Renders one OrganUI clinical component. Not a medical device: it displays data, it does not interpret it. Input:

```json
{"component": "<id>", "props": {...}, "title": "optional", "description": "optional"}
```

- `component`: one of the ids below.
- `props`: the component's props. Only props marked (required) are needed.
- `title`, `description`: optional heading and line under it.

## Clinical data rules

- Use only real data from the conversation or tool results: names, dates, readings, results, doses and codes. Never invent or "fill in" clinical values; ask for what is missing.
- `ecg-trace` `synthetic` and `image-viewer` without `slices` draw demo data. Use them only when the user asks for an example, and say it is not a patient's.
- `growth-chart` needs LMS `standards` the user supplies. Never make up a growth standard.

Props for the component, as JSON. Props are optional unless marked (required). Use only real data from the conversation. Dates are ISO 8601. ids are any unique strings.

## Components

- **body-map**: value (selected region ids; front: head, neck, groin, and right-/left- + shoulder, chest, upper-abdomen, lower-abdomen, upper-arm, forearm, palm, thigh, knee, shin, foot; back: back-of-head, back-of-neck, and right-/left- + shoulder-back, upper-back, lower-back, buttock, upper-arm-back, forearm-back, hand-back, thigh-back, knee-back, calf, heel; right/left are the person's own), views ([front, back]), label.
- **dermatome-map**: selectedId (C2-C8, T1-T12, L1-L5, S1-S4-5), colors ({level: CSS colour}), views, showLabels.
- **patient-banner**: patient (required: {name: {family, given: [], prefix}, birthDate, sex, identifiers: [{label, value}], deceasedDate}), allergies (substances, or "none-known"), alerts (strings such as DNACPR).
- **allergy-list**: allergies ([{id, substance, type: allergy|intolerance, reactions: [], severity: mild|moderate|severe, verification: confirmed|unconfirmed, status: active|inactive|resolved, recordedDate}], or "none-known"), caption.
- **problem-list**: problems (required: [{id, name, code: {system, value}, status: active|inactive|resolved, significance: major|minor, onset, resolved}]), caption, showCodes.
- **vital-signs**: readings (required: {heartRate, systolic, diastolic, spo2, temperature, respiratoryRate}, null when not measured), ranges ({vital: {low, high}} over adult defaults), vitals (heartRate, bloodPressure, spo2, temperature, respiratoryRate), temperatureUnit (celsius|fahrenheit), title, description.
- **news2-chart**: observations (required: [{time, respirationRate, spo2, onOxygen, systolic, pulse, consciousness: alert|confusion|voice|pain|unresponsive, temperature (°C)}]), spo2Scale (1|2), caption.
- **lab-results**: results (required: [{id, name, value (number or text), unit, date, referenceRange: {low, high, criticalLow, criticalHigh, text}, flag: critical-low|low|normal|high|critical-high|abnormal, history: [{value, date}], decimals}]), caption, showTrend.
- **medication-schedule**: medications (required: [{id, name, dose, instructions, times: ["HH:MM"], days: [0 Sunday to 6], start, end, color}]), date (required: "YYYY-MM-DD"), interactions ([{id, medicationIds, severity: minor|moderate|major, summary, separationHours}]), doseStatus ({"<medId>@<date>T<time>": taken|skipped}), now ("HH:MM").
- **ecg-trace**: samples (millivolts) or synthetic (a heart rate; draws a demo sinus rhythm, only when the user wants an example), sampleRate (default 250), duration (s), lead (default II), range ([min, max] mV), calibration, label.
- **growth-chart**: standards (required: LMS tables the user supplies, {weight|length|height|head: {female|male: {start: month, lms: [[L, M, S] per month]}}}), measure (required: weight|length|head), sex (required: female|male), measurements ([{ageMonths, value}]), percentiles, ageRange ([from, to] months).
- **anatomy-tree**: data (required: [{id, label, color, selectable, children: [...]}]), selectedId, visibility ({id: false} hides), defaultExpandedIds, label.
- **image-viewer**: slices ([{src: data: URL, label}] or [{data: numbers, width, height, label}]); without slices it shows a synthetic head phantom, never a patient; presets ([{name, center, width}]), pixelSpacing, unit, controls, label.
- **dna-helix**: sequence (5′ to 3′, A C G T), selectedIndex, autoRotate, strands, controls, label.
- **ai-note**: sections (required: [{id, title, content: [text, or {text, sources: [source ids]}]}]), sources ([{id, title, label, kind, date, detail}]), markUnsupported (default true), label.
- **clinical-sources**: sources (required, as in ai-note), defaultOpen.
- **clinical-citation**: source (required: one source).
- **differential-list**: items (required: [{id, name, confidence 0 to 1, code, supporting: [], against: []}]), label.
- **clinician-review**: reviewer (required: the clinician's name), subject, value ({status: pending|approved|changes-requested|rejected, reviewer, at, comment}).
- **ai-disclaimer**: model, generatedAt, review ({by, at, status: approved|changes-requested|rejected}).

## Examples

Where it hurts:
```json
{"component":"body-map","title":"Where does it hurt?","props":{"value":["right-knee","right-lower-back","left-lower-back"]}}
```

Vital signs:
```json
{"component":"vital-signs","props":{"readings":{"heartRate":112,"systolic":98,"diastolic":61,"spo2":93,"temperature":38.4,"respiratoryRate":22},"title":"Vital signs","description":"Taken 14:00"}}
```

Lab results:
```json
{"component":"lab-results","props":{"results":[{"id":"k","name":"Potassium","value":5.9,"unit":"mmol/L","date":"2026-10-25","referenceRange":{"low":3.5,"high":5.3,"criticalHigh":6.5},"history":[{"value":4.6,"date":"2026-10-01"},{"value":5.2,"date":"2026-10-15"},{"value":5.9,"date":"2026-10-25"}],"decimals":1},{"id":"u","name":"Urine culture","value":"Negative","referenceRange":{"text":"Negative"}}]}}
```

Differential:
```json
{"component":"differential-list","props":{"items":[{"id":"stemi","name":"Anterior STEMI","code":"I21.0","confidence":0.82,"supporting":["ST elevation V2–V4","Rising troponin"],"against":[]},{"id":"peri","name":"Pericarditis","code":"I30","confidence":0.12,"supporting":["Chest pain"],"against":["No PR depression"]}]}}
```
