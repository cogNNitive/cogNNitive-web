# Pruebas — innfo-editor

Este directorio contiene modelos iNNfo de prueba para verificar que la aplicación
carga, parsea y muestra correctamente modelos.

> **Nota**: El template `kb` y el modo `FOLDER` fueron eliminados en V_0-2-0.
> Todos los modelos usan modo `centralized` (single-file, `_NN.md`).

## Estructura completa

```
tests/
├── README.md                        # ⬅ estás acá
└── fixtures/
    ├── workspace-index.md           # Índice del workspace de prueba
    ├── file-model_NN.md         # Business — smoke test
    ├── sample-model_NN.md       # Business — validación mínima
    ├── music-business/
    │   └── music-business_NN.md  # Business — Vinyl Records Inc.
    └── music-production/
        └── music-production_NN.md # Procedures — Song Recording
```

## Propósito de cada modelo

| Modelo | Template | Propósito |
|--------|----------|-----------|
| `file-model_NN.md` | business_V_0-1-1 | Smoke test — 5 elementos inline con Business summary, Problems, Value propositions |
| `sample-model_NN.md` | business_V_0-1-1 | Validación mínima de forma — 1 elemento Problem |
| `music-business/` | business_V_0-1-1 | Negocio discográfico completo — Problems, Value propositions, Channels, Stakeholders, matriz |
| `music-production/` | procedures_V_0-1-1 | Workflow de grabación — Work steps, Artifacts, Tools, Roles, 3 matrices |

---

## Instrucciones paso a paso

### Requisito previo

```bash
cd apps/format-editor
npm install
npm --prefix ../../packages/format-core run build
```

### Modo 1: Prueba en el navegador (manual)

1. **Iniciar la app**
   ```bash
   cd apps/format-editor
   npm run dev
   ```
   Abrí http://localhost:5173/app/ en Chrome o Edge.

2. **Probar modelos**
   - En la Home, hacé clic en **"Open folder…"**
   - Navegá hasta `tests/fixtures/` y seleccioná la carpeta **completa**
   - ✅ En el árbol izquierdo aparecen todos los modelos registrados en `workspace-index.md`

3. **Navegación y vistas**
   - ✅ Hacé clic en cualquier nodo del árbol → se selecciona y se abre en el editor
   - ✅ Cambiá entre vistas: **editor**, **graph**, **matrices**, **info**
   - ✅ En vista "info" se ven metadatos del modelo
   - ✅ En vista "graph" se ve el grafo de nodos

### Modo 2: Prueba automatizada (vitest)

Los tests progresivos viven en `apps/format-editor/tests/progressive-smoke.test.ts`:

```bash
cd apps/format-editor

# Todos los tests del proyecto
npm test

# Solo los progresivos
npx vitest run tests/progressive-smoke.test.ts

# Con nombres detallados
npx vitest run tests/progressive-smoke.test.ts --reporter=verbose
```

---

## Árbol esperado por paso

### Paso 2 — Modelo FILE (`file-model_NN.md`)

| Nodo | Tipo/Kind | StorageMode | Padre |
|------|-----------|-------------|-------|
| file-model | root | FILE | null |
| Baja adopción | element | FILE | file-model |
| Costes elevados | element | FILE | file-model |
| Competencia agresiva | element | FILE | file-model |
| Onboarding exprés | element | FILE | file-model |
| Infraestructura optimizada | element | FILE | file-model |

### Modelo — Music Business (`music-business/music-business_NN.md`)

| Nodo | Tipo/Kind | StorageMode | Padre |
|------|-----------|-------------|-------|
| music-business | root | FILE | null |
| Business summary | text | FILE | music-business |
| Streaming revenue decline | element | FILE | Problems |
| Manufacturing costs | element | FILE | Problems |
| Discovery challenges | element | FILE | Problems |
| Audiophile quality | element | FILE | Value propositions |
| Curated catalog | element | FILE | Value propositions |
| Direct-to-fan | element | FILE | Value propositions |
| Record stores | element | FILE | Channels |
| Direct e-commerce | element | FILE | Channels |
| Artists | element | FILE | Stakeholders |
| Distributors | element | FILE | Stakeholders |
| Collectors | element | FILE | Stakeholders |
| problems-value propositions matrix | matrix | FILE | music-business |

### Modelo — Music Production (`music-production/music-production_NN.md`)

| Nodo | Tipo/Kind | StorageMode | Padre |
|------|-----------|-------------|-------|
| music-production | root | FILE | null |
| Procedure | text | FILE | music-production |
| Songwriting | element (Work) | FILE | Work |
| Pre-production | element (Work) | FILE | Work |
| Tracking | element (Work) | FILE | Work |
| Editing | element (Work) | FILE | Work |
| Mixing | element (Work) | FILE | Work |
| Mastering | element (Work) | FILE | Work |
| Demo recording | element (Artifact) | FILE | Artifact |
| Multitrack session | element (Artifact) | FILE | Artifact |
| Stereo mix | element (Artifact) | FILE | Artifact |
| Mastered track | element (Artifact) | FILE | Artifact |
| DAW | element (Tools) | FILE | Tools |
| Microphone | element (Tools) | FILE | Tools |
| Audio interface | element (Tools) | FILE | Tools |
| Monitoring headphones | element (Tools) | FILE | Tools |
| Producer | element (Roles) | FILE | Roles |
| Recording Engineer | element (Roles) | FILE | Roles |
| Mixing Engineer | element (Roles) | FILE | Roles |
| Mastering Engineer | element (Roles) | FILE | Roles |
| work-roles matrix | matrix | FILE | music-production |
| work-tools matrix | matrix | FILE | music-production |
| work-artifacts matrix | matrix | FILE | music-production |

---

## Checklist de validación

Al final de las pruebas deberías poder marcar todo esto:

- [ ] **Paso 1**: La home carga sin errores
- [ ] **Paso 2a**: Abro `tests/fixtures/` y veo los modelos en el árbol
- [ ] **Paso 2b**: Los elementos inline aparecen bajo cada modelo
- [ ] **Paso 3**: Navego entre vistas (editor/graph/matrices/info)
- [ ] **Paso 4**: Los tests automatizados pasan
- [ ] **Music Business**: Aparece music-business con 12 elementos y 1 matriz
- [ ] **Music Production**: Aparece music-production con 6 Work steps, 4 Artifacts, 4 Tools, 4 Roles, 3 matrices
