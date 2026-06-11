
## Ottimizzazione immagini

Per generare automaticamente le varianti responsive WebP, i placeholder low-res blur e il manifest dagli asset PNG originali:

```bash
python -m pip install -r requirements.txt
python scripts/optimize-images.py
```

Il comando legge i sorgenti da `assets/original/` e produce i derivati in `assets/optimized/`:

- `assets/optimized/nome-480.webp`
- `assets/optimized/nome-768.webp`
- `assets/optimized/nome-1024.webp`
- `assets/optimized/nome-1366.webp`
- `assets/optimized/nome-1672.webp`
- `assets/optimized/nome-placeholder.png`
- `data/image-assets.json`

Nei dati evento basta indicare la key:

```json
"revealImage": {
  "key": "barbari"
}
```

Per forzare la rigenerazione:

```bash
python scripts/optimize-images.py --force
```
