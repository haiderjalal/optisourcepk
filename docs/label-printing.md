# Label printing

Prints small stock labels (product name, SPH, CYL, ADD and eye) on a TSC TE244
label printer from the back-office. Printing is manual: open a product, pick a
power, say how many, press **Print labels**.

## How it works

```
Product page (browser)                Shop PC                       Printer
────────────────────────             ───────────────────────────   ──────────
LabelPrintPanel                       tools/label-printer           TSC TE244
  builds the label as TSPL    ──►       checks the request   ──►     prints
  (features/shop/labels)    POST          sends it to the Windows    (USB cable)
                          127.0.0.1:9777  print queue as raw data
```

The app runs on Vercel and cannot reach a USB printer, so a small helper runs on
the PC the printer is plugged into. The browser calls the helper on that PC's
own loopback address, which means labels can only print from that PC.

TSPL is the TE244's own command language. Sending it straight to the printer
keeps text (and later, barcodes) aligned to the printer's dots, which a page
rendered by the driver cannot promise. BarTender is not used.

| Piece                                          | Job                                                    |
| ---------------------------------------------- | ------------------------------------------------------ |
| `src/features/shop/labels/config.ts`           | Label size, gap, direction, helper address             |
| `src/features/shop/labels/tspl.ts`             | Turns a title and rows into a TSPL job; the test label |
| `src/features/shop/labels/stockLabel.ts`       | What a stock lens label says                           |
| `src/features/shop/labels/printClient.ts`      | Sends a job to the helper from the browser             |
| `src/features/shop/labels/LabelPrintPanel.tsx` | The "Print labels" panel on the product page           |
| `tools/label-printer/`                         | The helper that runs on the shop PC                    |

## Set up the shop PC (once)

1. **Driver.** Install the TSC TE244 driver and confirm Windows can print its
   test page.
2. **Printer name.** Open Settings → Bluetooth & devices → Printers & scanners
   and note the printer's exact name (for example `TSC TE244`).
3. **Node.js.** Install the current LTS version from nodejs.org.
4. **The helper.** Copy the `tools/label-printer` folder to the PC, for example
   to `C:\label-printer`.
5. **Settings.** Copy `config.example.json` to `config.json` and set
   `printerName` to the name from step 2. Everything else can stay as it is.
6. **Start it.** Double-click `start-label-printer.bat` and keep the window
   open. It prints the printer name it found, or lists the names that exist if
   yours does not match. To start it with Windows, put a shortcut to the file in
   the Startup folder (Win+R, then `shell:startup`).
7. **Browser.** Use Chrome or Edge 142 or newer. The first time you press
   Print, the browser asks whether this site may connect to a program on your
   PC. Choose Allow.
8. **Check it.** Open a product that has stock and press **Print a test label**.

## Label size and gap

The roll is assumed to be 75 × 25 mm with a 3 mm gap, set at the top of
`src/features/shop/labels/config.ts`. Measure the real roll and correct the
numbers if needed. The test label draws a frame around the whole label: the
frame must show on all four sides.

| What you see                         | What to change                                     |
| ------------------------------------ | -------------------------------------------------- |
| Frame cut off at the bottom or right | `LABEL_WIDTH_MM` / `LABEL_HEIGHT_MM` are too large |
| Printing drifts down label by label  | `LABEL_GAP_MM` or `LABEL_HEIGHT_MM` is wrong       |
| A blank label between each label     | `LABEL_HEIGHT_MM` is too small                     |
| Everything prints upside down        | Switch `PRINT_DIRECTION` between 0 and 1           |
| Print too light or too dark          | `PRINT_DENSITY` (0 to 15)                          |

If the printer still feeds the wrong amount after the numbers are right, run
the sensor calibration once (hold the FEED button, or use TSC's Diagnostic Tool)
with the roll loaded.

## Troubleshooting

| Message or symptom                           | Likely cause                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "Can't reach the label printer helper"       | The helper is not running, or this is not the PC the printer is plugged into                        |
| "This browser is blocking the label printer" | The permission was refused. Allow Local network access for the site in the browser's settings       |
| "The printer did not accept the label"       | Printer off, cable out, paused in Windows, or the wrong `printerName`. The helper window says which |
| Helper says `no printer named …`             | `printerName` in `config.json` differs from the name in Windows; it lists the names that exist      |
| Helper says the port is already in use       | The helper is already running; close the second window                                              |

## Security

- The helper listens on `127.0.0.1` only, so nothing else on the network can
  reach it.
- It accepts a print request only from the origins in `allowedOrigins`
  (`config.json`), and only when the `Host` is its own address. Add a preview
  URL there if you need to print from one.
- It accepts plain printable text and nothing larger than 64 KB. Product names
  are stripped of quotes, backslashes and non-ASCII characters before they go
  into a label, so a name can never become a printer command.
- No secrets are involved: the helper never talks to Supabase or the app.

## Developing without a printer

Set `"dryRun": true` in `config.json`. The helper then writes each job to
`out/last-job.tspl` instead of printing it. `config.json` and `out/` are not
committed.

## Not built yet

- **Barcodes.** Stock has no short, stable code to encode (`products.sku` is
  unused and a UUID is too long for a small label). When scanning is wanted, add
  a short `label_code` to `stock_bins` in a migration, then print it with the
  `BARCODE` command in `tspl.ts`.
- **Printing from other devices.** The helper is local to one PC. A phone or a
  second PC would need a print queue in the cloud that the helper polls.
- **Labels from the Stock and Purchases screens, and RX job labels.** Only the
  product page prints for now.
