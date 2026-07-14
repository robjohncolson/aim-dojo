# Zodiac sign art

Sky Temple loads these when you investigate a **sign**. Art sits on a plane
**behind** the stick-figure constellation (past sticks, inside the milky shell).

## Shipped set

Thirteen Midpoint signs (incl. Ophiuchus), as **silver-gold on transparent PNG**:

| File | Sign |
|------|------|
| `aries.png` … `pisces.png` | classic 12 |
| `ophiuchus.png` | 13th Midpoint sign |

Processing (from black-on-white line art):

- **White / near-white** → fully transparent (milky sky shows through)
- **Black / ink** → warm silver-gold `#E8D6A8` with soft edge alpha

## Drop-in / replace

Loader prefers **`{id}.png`**, then **`{id}.jpg`**.

Ids: `aries` `taurus` `gemini` `cancer` `leo` `virgo` `libra` `scorpio`
`ophiuchus` `sagittarius` `capricorn` `aquarius` `pisces`

Paths defined in `sky-maps.js` (`mapForSign` / `mapForSignPng`).

## Encoding (PERF P2)

Shipped at **max-edge 512**, **FASTOCTREE 128-color** quantized PNG (alpha kept),
~40–64 KB each. These render additive at ~0.09 opacity behind the sticks, so heavy
quantization is imperceptible. Drop-in replacements can be any size/quality —
`scratchpad/p2/encode_p2.py` shows the recipe if you want to match the belt weight.
