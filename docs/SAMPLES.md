# Instrument samples

The acoustic instrument sounds in ∞ Melodies come from
[nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments),
licensed **CC-BY 3.0**.

Sources listed by that project:

- piano, organ, harmonium, cello, violin, flute, contrabass, xylophone — VSCO 2
  Community Edition (Versilian Studios), CC0.
- guitar-nylon — Freesound, “classical guitar multisampled” by quartertone.
- bass-electric — Karoryfer Samples.

The files are bundled locally under `public/samples/` so the app can work
offline after the first load. The sample pack is loaded lazily and cached by
the service worker; the synthesizer remains the fallback when samples are
unavailable.

If you redistribute the app, keep this attribution and the CC-BY 3.0 notice.
