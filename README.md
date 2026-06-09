# Sagre Perugia

Pagina web statica per consultare sagre, feste popolari ed eventi paesani a Perugia e dintorni.

## Struttura

- `index.html`: pagina principale
- `styles.css`: layout e stati visivi
- `app.js`: filtro, conteggi e stato temporale degli eventi
- `data/sagre.json`: elenco data-driven delle sagre
- `assets/sagra-perugia.png`: immagine hero e sfondo in trasparenza

## Avvio locale

La pagina carica il JSON con `fetch`, quindi va servita via HTTP:

```bash
python -m http.server 8000
```

Poi apri `http://localhost:8000`.
