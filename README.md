
## Ottimizzazione immagini

Per generare automaticamente le varianti responsive WebP e i placeholder low-res blur dagli asset PNG:

```bash
python -m pip install -r requirements.txt
python scripts/optimize-images.py
```

Il comando converte tutti i `*.png` in `assets/`, ignorando i file `*-placeholder.png`, e produce file come:

- `assets/nome-480.webp`
- `assets/nome-768.webp`
- `assets/nome-1024.webp`
- `assets/nome-1366.webp`
- `assets/nome-1672.webp`
- `assets/nome-placeholder.png`

Per forzare la rigenerazione:

```bash
python scripts/optimize-images.py --force
```
