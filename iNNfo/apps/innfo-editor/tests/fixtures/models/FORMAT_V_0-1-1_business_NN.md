---
spec_version: "V_0-1-1"
knowledge_version: "V_0-1-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/v0.1.1/specs/FORMAT_V_0-1-1_FORMAT.md"
level: 3
parent:
  name: "business_V_0-1-1"
  url: "https://raw.githubusercontent.com/cogNNitive/iNNfo/v0.1.1/specs/business_V_0-1-1_NN.md"
mode: "FILE"
title: "FORMAT"
last_saved: "2026-06-26T20:53:24.782Z"

---

> [!NOTE]
> This is a **FORMAT document** — a plain-text Markdown file that carries its own schema in the YAML frontmatter. New to FORMAT? The [onboarding guide](https://format.innv0.com/docs/onboarding) walks you through what this is and how to open it in the visual editor.

# <!-- _NN --> Business summary

innV0 es una compañía que desarrolla y comercializa **plantillas estructuradas** basadas en el formato abierto FORMAT. Cada plantilla es un producto independiente con su propio público objetivo, propuesta de valor y lógica de monetización. Comparten un backend común: el **engine FORMAT** (especificación open-source + editor de navegador), que se distribuye gratuitamente como habilitador del ecosistema.

Actualmente hay dos líneas de producto:

1. **Business Template** — Modelado de estrategia de negocio en un solo archivo Markdown. Para founders, consultores, PMs e inversores. Resuelve el problema de contexto fragmentado para IA y validación de coherencia estratégica.

2. **Procedures Template** — Documentación de procesos, workflows y SOPs. Para equipos de ops, engineering leads y compliance. Resuelve el problema de conocimiento tribal no documentado y procedimientos no auditables.

Cada plantilla se puede consumir gratis (engine local), en la nube (SaaS colaborativo) o en enterprise (on-premise). El modelo de ingresos combina suscripciones SaaS por producto, licencias enterprise y servicios profesionales.

# <!-- _NN --> Stakeholders

* <!-- _NN Stakeholders: --> Strategy Founders (Business Template)
scope:: external
weight:: 85
interest:: "Validar su modelo de negocio con IA. Un archivo = contexto completo."
influence:: high
* <!-- _NN Stakeholders: --> Strategy Consultants (Business Template)
scope:: external
weight:: 80
interest:: "Gestionar múltiples modelos de cliente. Formato portable para análisis con IA."
influence:: high
* <!-- _NN Stakeholders: --> Product Managers (Business Template)
scope:: external
weight:: 70
interest:: "Trazar features a problemas validados. Alinear roadmap con estrategia."
influence:: medium
* <!-- _NN Stakeholders: --> Engineering Leads (Procedures Template)
scope:: external
weight:: 75
interest:: "Documentar deploys, code review, incident response como procedimientos versionados."
influence:: medium
* <!-- _NN Stakeholders: --> Ops & Compliance Teams (Procedures Template)
scope:: external
weight:: 85
interest:: "SOPs auditables, procedimientos estandarizados, trazabilidad regulatoria."
influence:: very high
* <!-- _NN Stakeholders: --> Enterprise Decision Makers (ambos)
scope:: external
weight:: 90
interest:: "On-premise, SSO, audit trails, custom templates. Una plataforma para toda la organización."
influence:: very high
* <!-- _NN Stakeholders: --> Open Source Community
scope:: external
weight:: 65
interest:: "Contribuidores del engine FORMAT. Creadores de nuevas templates."
influence:: medium
* <!-- _NN Stakeholders: --> Core Team (innV0)
scope:: internal
weight:: 100
interest:: "Desarrollar el engine, las templates, la comunidad y los ingresos."
influence:: critical

# <!-- _NN --> Segments

* <!-- _NN Segments: --> Consultancies (Business)
weight:: 80
size:: "50K+ firmas"
need:: "Multi-cliente, informes profesionales, análisis IA"
revenue_potential:: "Alto — $99–$299/mes por firma"

* <!-- _NN Segments: --> Enterprise (ambas templates)
weight:: 95
size:: "20K+ empresas 200+ empleados"
need:: "On-premise, SSO, compliance, templates custom, toda la org"
revenue_potential:: "Muy alto — $10K–$100K/año"

* <!-- _NN Segments: --> Founders & Solopreneurs (Business)
weight:: 80
size:: "Millones globalmente"
need:: "Contexto IA gratuito para fundraising y validación"
revenue_potential:: "Bajo directo (gratis) — alto indirecto (adopción)"

* <!-- _NN Segments: --> SMB Strategy Teams (Business)
weight:: 85
size:: "Cientos de miles"
need:: "Edición colaborativa, Git integration, AI audits"
revenue_potential:: "Medio — $29–$99/mes por equipo"

* <!-- _NN Segments: --> Engineering Teams (Procedures)
weight:: 75
size:: "Millones de desarrolladores"
need:: "SOPs de deploy, incident response, code review como código"
revenue_potential:: "Medio — $19–$79/mes por equipo"

* <!-- _NN Segments: --> Ops & Compliance (Procedures)
weight:: 85
size:: "200K+ equipos en industrias reguladas"
need:: "Procedimientos auditables, roles, pasos secuenciados, trazabilidad"
revenue_potential:: "Alto — $49–$149/mes por equipo"

* <!-- _NN Segments: --> Template Creators (ecosistema futuro)
weight:: 50
size:: "Nichos por industria"
need:: "Marketplace para vender templates especializadas"
revenue_potential:: "Comisión 20-30% por venta"

# <!-- _NN --> Profiles

* <!-- _NN Profiles: --> Solo técnico, pre-seed, 25-40 años, $0-$50/mes
weight:: 80
demographics:: "25-40 años, background técnico, etapa pre-seed o bootstrapped"
need:: "Documentar modelo de negocio rápido, usar con ChatGPT/Claude para advice estratégico"
budget:: "$0–$50/mes en herramientas"
behavior:: "Descubre tools por Product Hunt, GitHub, Hacker News. Adopta gratis, paga cuando escala."
template:: Business
* <!-- _NN Profiles: --> Consultor estratégico, MBA, 30-55 años, $100-$500/mes
weight:: 85
demographics:: "30-55 años, MBA, trabaja en boutique o Big4 consulting"
need:: "Gestionar 5-15 modelos de cliente, producir informes de coherencia, apalancar IA para análisis"
budget:: "$100–$500/mes en herramientas"
behavior:: "Evalúa herramientas rigurosamente. Necesita exportación a PPT/PDF para entrega a cliente."
template:: Business
* <!-- _NN Profiles: --> Líder de ops, 30-50 años, industria regulada, $50-$200/mes
weight:: 80
demographics:: "30-50 años, industria regulada (fintech, salud, manufactura), rol de ops/compliance"
need:: "Estandarizar procesos, auditoría, roles claros, trazabilidad regulatoria"
budget:: "$50–$200/mes en herramientas"
behavior:: "Adopta por necesidad regulatoria. Valora trazabilidad y compliance por encima de UX."
template:: Procedures
* <!-- _NN Profiles: --> Engineering manager, 28-45 años, técnico, $20-$100/mes
weight:: 75
demographics:: "28-45 años, lidera equipo de ingeniería, background developer"
need:: "SOPs de deploy, runbooks, incident response documentados y versionados"
budget:: "$20–$100/mes en herramientas"
behavior:: "Valora integración con Git, PRs para cambios de proceso, diffs de procedimientos."
template:: Procedures
* <!-- _NN Profiles: --> Enterprise architect, 40-60 años, C-level/VP, $10K-$100K/año
weight:: 90
demographics:: "40-60 años, director/VP, industria regulada (finance, healthcare, defense)"
need:: "On-premise, SSO, audit trail, templates custom, compliance"
budget:: "$10K–$100K/año para herramientas estratégicas"
behavior:: "Requiere procurement process, security review, vendor assessment. Ciclo de decisión largo."
template:: "Ambos"

# <!-- _NN --> Persona

**Alex Moreno** — Fundador solitario, 32, Barcelona. Construyó un MVP SaaS B2B y prepara ronda pre-seed.

Cada mañana abre ChatGPT para trabajar en estrategia — pero gasta 10 minutos reexplicando el negocio. Las respuestas son genéricas porque la IA no tiene contexto completo.

Alex encontró FORMAT + Business Template en GitHub. Ahora tiene un `startup.md`. Lo pega en cualquier conversación con IA. Contexto completo al instante.

*Usa el engine gratis. Pagaría cuando el equipo crezca a 3+. No le interesa Procedures Template.*

**María López** — Ops Lead, 38, fintech regulada en Madrid.

Necesita documentar 15 procedimientos críticos para auditoría SOC2. Cada procedimiento tiene roles, pasos exactos, y necesita firma de aprobación. Hoy vive en Google Docs sin control de versiones.

María usa Procedures Template. Cada procedimiento es un archivo Markdown versionado en Git. Los auditors pueden ver el historial de cambios. El compliance se vuelve trazable.

*Usa el engine gratis con Procedures Template. Su empresa pagaría por Enterprise para SSO y audit trail.*

# <!-- _NN --> Segmentation

* <!-- _NN Segmentation: --> Por Plantilla (línea de negocio)
weight:: 95
criteria:: "Business (estrategia) vs Procedures (procesos) — audiencias mutuamente excluyentes"
* <!-- _NN Segmentation: --> Por Tamaño de Organización
weight:: 85
criteria:: "Solo (1), SMB (2-20), Mid-market (20-200), Enterprise (200+)"
* <!-- _NN Segmentation: --> Por Madurez Técnica
weight:: 70
criteria:: "Bajo-código (editor UI), Developer (Git + IA), Enterprise (compliance)"
* <!-- _NN Segmentation: --> Por Industria
weight:: 60
criteria:: "Tech (40%), Consultoría (25%), Fintech/Salud (20%), Otros (15%)"

# <!-- _NN --> Market trends

* <!-- _NN Market trends: --> IA necesita contexto estructurado
weight:: 95
description:: "Toda empresa necesita alimentar IA con contexto de negocio. FORMAT + templates es el formato."
* <!-- _NN Market trends: --> Knowledge management se fusiona con IA
weight:: 85
description:: "Herramientas de documentación (Notion, Confluence) compiten con herramientas de IA. Las templates de FORMAT cubren ambos."
* <!-- _NN Market trends: --> Open-source / local-first como ventaja
weight:: 80
description:: "Empresas no quieren subir datos estratégicos a servidores de terceros. FORMAT engine corre 100% local."
* <!-- _NN Market trends: --> Procesos como código
weight:: 75
description:: "SOPs versionados en Git, PRs para cambios de proceso, diff de procedimientos. Procedures template capitaliza esto."
* <!-- _NN Market trends: --> Fragmentación de herramientas
weight:: 70
description:: "Cada equipo usa herramientas distintas. FORMAT unifica el backend. Templates especializan el frontend."

# <!-- _NN --> Market size

**Business Template SAM:** $1.8B (modelado de negocio + contexto IA + planning estratégico)
**Procedures Template SAM:** $1.2B (documentación de procesos + SOPs + compliance ops)

**SOM combinado Year 3:** $15M (0.5% de ambos mercados combinados)

| Métrica | Year 1 | Year 2 | Year 3 |
| :--- | ---: | ---: | ---: |
| Usuarios engine (gratis) | 5,000 | 25,000 | 100,000 |
| Equipos Business Cloud | 35 | 200 | 900 |
| Equipos Procedures Cloud | 15 | 100 | 600 |
| Deployments Enterprise | 0 | 3 | 20 |

# <!-- _NN --> Competition

* <!-- _NN Competition: --> Strategyzer / Canvanizer (Business)
weight:: 70
threat:: medium
diff:: "Canvases estáticos, no IA-ready, sin matrices relacionales ni versionado"
* <!-- _NN Competition: --> Notion / Confluence (ambas)
weight:: 80
threat:: medium
diff:: "No estructurado, sin coherencia scoring, sin formato estandarizado para IA"
* <!-- _NN Competition: --> Miro / Mural (Business)
weight:: 65
threat:: low
diff:: "Visual, no machine-readable, sin Git, sin parseo IA"
* <!-- _NN Competition: --> Process.st / SweetProcess (Procedures)
weight:: 70
threat:: medium
diff:: "SaaS cerrados, caros, sin versionado Git, sin IA context"
* <!-- _NN Competition: --> Confluence Whiteboards (Procedures)
weight:: 60
threat:: low
diff:: "Propietario, sin formato portable, sin especificación abierta"

# <!-- _NN --> Problems

* <!-- _NN Problems: --> IA no tiene contexto de negocio
weight:: 90
description:: "Cada conversación con IA arranca de cero. El usuario gasta 10 min reexplicando su negocio antes de obtener respuestas útiles."
* <!-- _NN Problems: --> Fragmentación de información estratégica
weight:: 85
description:: "Slides, Notion, Google Docs, spreadsheets — no hay una fuente única de verdad. La IA no puede leerlas coherentemente."
* <!-- _NN Problems: --> Procedimientos no documentados (conocimiento tribal)
weight:: 80
description:: "El conocimiento de procesos vive en cabezas. Cuando alguien se va, el conocimiento se pierde. Sin procedimientos auditables."
* <!-- _NN Problems: --> Modelos de negocio estáticos
weight:: 75
description:: "Se crean una vez y nunca se actualizan. Obsoletos al guardarlos. Sin versionado ni historia."
* <!-- _NN Problems: --> Sin validación de coherencia
weight:: 70
description:: "No hay forma automática de saber si la estrategia es consistente. Problems pueden no alinearse con features. Métricas sin conectar a goals."
* <!-- _NN Problems: --> Compliance y auditoría sin trazabilidad
weight:: 75
description:: "Procedimientos en documentos sueltos. Sin historial de cambios. Los auditores no pueden verificar versiones anteriores."

# <!-- _NN --> Value propositions

* <!-- _NN Value propositions: --> Engine FORMAT gratis + open-source
weight:: 95
description:: "El engine es gratuito. Corre 100% en el navegador. Sin servidor, sin cuenta, sin upload. La especificación es abierta."
* <!-- _NN Value propositions: --> Business Template: Un archivo = contexto IA completo
weight:: 90
description:: "Pega tu archivo .md en ChatGPT/Claude/Gemini. La IA entende tu negocio entero al instante: segmentos, problemas, soluciones, finanzas."
* <!-- _NN Value propositions: --> Procedures Template: Procesos como código
weight:: 85
description:: "Cada procedimiento es un archivo Markdown versionado en Git. PRs para cambios de proceso. Diff de procedimientos. Historial de auditoría."
* <!-- _NN Value propositions: --> Estrategia versionada (Business)
weight:: 80
description:: "Tu modelo de negocio vive en Git. Branch, diff, y PR tu estrategia. Cada cambio es trazable y reversible."
* <!-- _NN Value propositions: --> Coherencia automatizada (Business)
weight:: 75
description:: "Motor de IA que scorea la consistencia entre problems, value propositions, features y metrics. Encuentra gaps antes de construir."
* <!-- _NN Value propositions: --> Matrices relacionales (Business)
weight:: 75
description:: "Cada concepto se conecta a otros mediante matrices con scoring. Traza cualquier feature hasta un problema validado del cliente."
* <!-- _NN Value propositions: --> Trazabilidad regulatoria (Procedures)
weight:: 80
description:: "Cada cambio en un procedimiento queda registrado. Versiones inmutables. Ideal para SOC2, ISO27001, auditorías."
* <!-- _NN Value propositions: --> Multi-cliente para consultoras (Business)
weight:: 65
description:: "Gestioná 5-15 modelos de cliente simultáneamente. Cada uno es un archivo independiente. IA con contexto completo por cliente."

# <!-- _NN --> Offerings

* <!-- _NN Offerings: --> FORMAT Engine (Open Source)
weight:: 100
revenue_model:: "Gratis — habilita el ecosistema"
description:: "Especificación abierta + editor de navegador. Parseo, renderizado, matrices, marcadores, graph visualization. MIT license. Corre offline."
status:: "shipping"
* <!-- _NN Offerings: --> Business Template Cloud
weight:: 95
revenue_model:: "Suscripción SaaS — línea de negocio 1"
description:: "Edición colaborativa de modelos de negocio, AI audits, exportación PDF/PPT, Git integration, librerías compartidas."
status:: "en desarrollo"
* <!-- _NN Offerings: --> Procedures Template Cloud
weight:: 90
revenue_model:: "Suscripción SaaS — línea de negocio 2"
description:: "Editor colaborativo de procedimientos, secuencia de pasos, roles, aprobaciones, historial de auditoría, exportación."
status:: "en desarrollo"
* <!-- _NN Offerings: --> Enterprise Suite
weight:: 85
revenue_model:: "Licencia anual (ambas templates)"
description:: "Self-hosted, SSO, RBAC, audit trails, templates custom, SLAs, soporte dedicado. Cubre Business y Procedures."
status:: "planeado"
* <!-- _NN Offerings: --> Professional Services
weight:: 65
revenue_model:: "Consultoría por hora/proyecto"
description:: "Workshops de modelado, templates custom, integración con agentes IA, training y onboarding."
status:: "planeado"
* <!-- _NN Offerings: --> Template Marketplace (futuro)
weight:: 50
revenue_model:: "Comisión 20-30%"
description:: "Marketplace de templates de terceros: industria-specific (healthcare, fintech), methodology-specific (Lean Canvas, Blue Ocean)."
status:: "futuro"

# <!-- _NN --> Pricing

* <!-- _NN Pricing: --> Engine (Open Source)
weight:: 100
price:: "$0"
target:: "Todos — adopción sin fricción"
constraints:: "Solo archivos locales, sin colaboración, sin cloud"
* <!-- _NN Pricing: --> Business Starter
weight:: 80
price:: "$29/mes (hasta 3 usuarios)"
target:: "Founders, startups early-stage"
constraints:: "5 modelos activos, AI audits básicos, Git integration"
* <!-- _NN Pricing: --> Business Professional
weight:: 85
price:: "$99/mes (hasta 10 usuarios)"
target:: "Consultoras, equipos de estrategia"
constraints:: "Modelos ilimitados, AI audits avanzados, exportación PDF/PPT"
* <!-- _NN Pricing: --> Procedures Standard
weight:: 80
price:: "$49/mes (hasta 10 usuarios)"
target:: "Equipos de ops, engineering"
constraints:: "Procedimientos ilimitados, historial de auditoría, roles"
* <!-- _NN Pricing: --> Procedures Professional
weight:: 75
price:: "$149/mes (usuarios ilimitados)"
target:: "Compliance, industrias reguladas"
constraints:: "Aprobaciones, reportes de compliance, exportación regulatoria"
* <!-- _NN Pricing: --> Enterprise Suite
weight:: 90
price:: "$10K–$100K/año (self-hosted)"
target:: "Enterprise, gobierno, industria regulada"
constraints:: "Ambas templates, on-premise, SSO, audit, custom, soporte dedicado"
* <!-- _NN Pricing: --> Consulting
weight:: 60
price:: "$200–$500/hora"
target:: "Enterprise onboarding, templates custom"

# <!-- _NN --> Revenue

* <!-- _NN Revenue: --> Business Template Cloud
weight:: 100
type:: "recurring"
projection:: "Year 1: $35K Â· Year 2: $400K Â· Year 3: $1.6M"
description:: "Línea de negocio principal. Target 55% de ingresos totales Year 3."
* <!-- _NN Revenue: --> Procedures Template Cloud
weight:: 85
type:: "recurring"
projection:: "Year 1: $12K Â· Year 2: $150K Â· Year 3: $700K"
description:: "Segunda línea de negocio. Target 25% de ingresos totales Year 3."
* <!-- _NN Revenue: --> Enterprise Licenses
weight:: 85
type:: "annual contract"
projection:: "Year 1: $0 Â· Year 2: $200K Â· Year 3: $1.2M"
description:: "Contratos anuales de alto valor. Ambas templates. Target 20% de ingresos Year 3."
* <!-- _NN Revenue: --> Professional Services
weight:: 60
type:: "variable"
projection:: "Year 1: $10K Â· Year 2: $80K Â· Year 3: $250K"
description:: "Consultoría, training, templates custom. Target 5% de ingresos Year 3."
* <!-- _NN Revenue: --> Marketplace Commissions
weight:: 35
type:: "variable"
projection:: "Year 1: $0 Â· Year 2: $0 Â· Year 3: $40K"
description:: "Futuro. Comisión sobre templates de terceros."

**Revenue Mix Projection (Year 3):**
| Stream | Annual | % |
| :--- | ---: | ---: |
| Business Template Cloud | $1,600,000 | 42.2% |
| Procedures Template Cloud | $700,000 | 18.5% |
| Enterprise Licenses | $1,200,000 | 31.6% |
| Professional Services | $250,000 | 6.6% |
| Marketplace | $40,000 | 1.1% |
| **Total** | **$3,790,000** | **100%** |

# <!-- _NN --> Costs

* <!-- _NN Costs: --> Engineering (ambas templates + engine)
weight:: 95
type:: "fixed"
estimate:: "$200K–$350K/año (2-4 FTEs)"
description:: "Desarrollo del engine, templates Business y Procedures, infraestructura"
* <!-- _NN Costs: --> Cloud Infrastructure
weight:: 80
type:: "variable"
estimate:: "$15K–$80K/año (escala con usuarios)"
description:: "Servidores para cloud SaaS de ambas templates, APIs de IA, storage"
* <!-- _NN Costs: --> Marketing & Growth
weight:: 75
type:: "variable"
estimate:: "$30K–$80K/año"
description:: "Content marketing segmentado por template, SEO, developer relations, comunidad"
* <!-- _NN Costs: --> Design & UX
weight:: 60
type:: "variable"
estimate:: "$30K–$60K/año"
description:: "UI/UX de ambas templates, dashboard renderers, documentación visual"
* <!-- _NN Costs: --> Operations
weight:: 50
type:: "fixed"
estimate:: "$15K–$30K/año"
description:: "Herramientas, suscripciones, contabilidad, legal"

**Cost Projection:**
| Category | Year 1 | Year 2 | Year 3 |
| :--- | ---: | ---: | ---: |
| Engineering | $200K | $280K | $350K |
| Infrastructure | $15K | $40K | $80K |
| Marketing | $30K | $60K | $80K |
| Design | $30K | $45K | $60K |
| Operations | $15K | $20K | $30K |
| **Total** | **$290K** | **$445K** | **$600K** |

# <!-- _NN --> Funding sources

Bootstrapped. El engine open-source y el contenido orgánico (GitHub, blogs, Product Hunt) mantienen el CAC bajo. Las suscripciones Cloud de ambas templates deben financiar el crecimiento antes de necesitar ronda externa.

Si Enterprise traction valida el modelo antes de lo esperado, una ronda seed de $500K-$1M podría acelerar el equipo de ventas enterprise.

# <!-- _NN --> Projections

| Métrica | Year 1 | Year 2 | Year 3 |
| :--- | ---: | ---: | ---: |
| Usuarios engine (gratis) | 5,000 | 25,000 | 100,000 |
| Equipos Business Cloud | 35 | 200 | 900 |
| Equipos Procedures Cloud | 15 | 100 | 600 |
| Deployments Enterprise | 0 | 3 | 20 |
| ARR | $57,000 | $750,000 | $3,500,000 |
| Total Revenue | $57,000 | $750,000 | $3,790,000 |
| Total Costs | $290,000 | $445,000 | $600,000 |
| Gross Margin | -$233,000 | $305,000 | $3,190,000 |
| **Runway** | Bootstrapped (pre-ingresos) | Rentable | Auto-sustentable |

Break-even proyectado en Month 22-26, cuando las suscripciones combinadas de ambas templates cruzan la línea de costos.

# <!-- _NN --> Unit economics

**Business Starter ($29/mes):**
- CAC estimado: $120 (adquisición orgánica)
- LTV estimado: $870 (30 meses retención)
- LTV/CAC: 7.3x

**Business Professional ($99/mes):**
- CAC estimado: $250 (ciclo de evaluación más largo)
- LTV estimado: $3,960 (40 meses retención)
- LTV/CAC: 15.8x

**Procedures Standard ($49/mes):**
- CAC estimado: $100 (necesidad inmediata, menor fricción)
- LTV estimado: $1,470 (30 meses retención)
- LTV/CAC: 14.7x

**Enterprise ($20K/año promedio):**
- CAC estimado: $4,000 (ventas asistidas, ciclo largo)
- LTV estimado: $80,000 (4 años retención)
- LTV/CAC: 20x

**Clave:** El engine gratuito es el driver de tráfico más eficiente. Conversión estimada free → paid: 2-3% para Business, 4-5% para Procedures (necesidad más inmediata).

# <!-- _NN --> Customer Aquisition Cost

| Canal | Business CAC | Procedures CAC | Volumen |
| :--- | ---: | ---: | ---: |
| GitHub / Orgánico | $20 | $20 | Primario |
| Content Marketing (SEO) | $80 | $50 | Alto |
| Developer Relations | $120 | $80 | Medio |
| Paid Acquisition (Cloud) | $250 | $150 | Medio |
| Enterprise Sales | $4,000 | $4,000 | Bajo |

**Blended CAC target:** $80-100 (Business), $60-80 (Procedures), $4,000 (Enterprise).

# <!-- _NN --> Life Time Value

| Tier | Monthly Price | Avg Months | LTV | LTV/CAC |
| :--- | ---: | ---: | ---: | ---: |
| Business Starter | $29 | 30 | $870 | 7.3x |
| Business Professional | $99 | 40 | $3,960 | 15.8x |
| Procedures Standard | $49 | 30 | $1,470 | 14.7x |
| Procedures Professional | $149 | 36 | $5,364 | 35.8x |
| Enterprise | $1,667 | 48 | $80,000 | 20x |

# <!-- _NN --> Inspiration

El problema es personal: cada vez que abríamos ChatGPT para preguntar algo estratégico, gastábamos 10 min reexplicando el negocio. Las respuestas eran genéricas porque la IA carecía de contexto. Nos dimos cuenta que el problema no era la IA — era cómo empaquetamos el conocimiento.

FORMAT nació de esa convicción: un archivo, machine-readable, versionado, y usable instantáneamente como contexto de IA. Las templates nacieron de ver que diferentes audiencias necesitaban diferentes estructuras.

# <!-- _NN --> Opportunity

Dos mercados grandes convergen con una misma solución de backend:
1. **Business**: IA necesita contexto estratégico estructurado
2. **Procedures**: Compliance y ops necesitan procesos versionados y auditables

Ambos comparten el mismo engine. Ambos tienen disposición a pagar. Ambos se refuerzan mutuamente: un enterprise que adopta Business Template puede extender a Procedures Template (y viceversa).

# <!-- _NN --> Challenges

* <!-- _NN Challenges: --> Dos productos que dividen atención
weight:: 85
mitigation:: "Engine común minimiza esfuerzo duplicado. Priorizar Business (mayor mercado) sobre Procedures."
* <!-- _NN Challenges: --> Adoption requiere cambio de hábito
weight:: 80
mitigation:: "Editor visual baja la barrera. Templates gratuitas eliminan riesgo. Samples (Ghostbusters, FORMAT) muestran el patrón."
* <!-- _NN Challenges: --> Enterprise sales cycle largo
weight:: 75
mitigation:: "Comenzar con Cloud self-serve. Enterprise después de validar product-market fit."
* <!-- _NN Challenges: --> Single founder risk
weight:: 70
mitigation:: "Comunidad open-source contribuye. Documentar arquitectura. Contratar cuando Cloud genere ingresos."
* <!-- _NN Challenges: --> Competencia indirecta de Notion/Confluence
weight:: 65
mitigation:: "Diferenciarse por IA-readiness, open-source, versionado Git. No competir por features — competir por paradigma."

# <!-- _NN --> Business status

FORMAT engine: **shipping** (V_0-1-4 spec). Business y Procedures templates: **en uso** como templates open-source. Cloud tiers: **en desarrollo**. Enterprise: **planeado**.

Revenue actual: $0 (pre-monetización, construyendo adopción).

# <!-- _NN --> Vision

Un mundo donde cada equipo — sea de estrategia, ops, engineering, o compliance — tenga sus conocimientos estructurados en archivos FORMAT. Donde los agentes de IA no necesiten presentaciones. Donde la coherencia estratégica y la trazabilidad regulatoria se verifiquen automáticamente.

innV0 es la compañía que hace esto posible: un engine abierto y gratuito, y templates especializadas que diferentes audiencias pagan por usar.

# <!-- _NN --> Mission

Dar a cada equipo un formato estándar para estructurar su conocimiento de forma que sea instantáneamente usable por cualquier modelo de IA — eliminando la fragmentación de contexto, habilitando validación automatizada, y haciendo el conocimiento versionable y portable.

# <!-- _NN --> Organizational values

* <!-- _NN Organizational values: --> Open by default
weight:: 95
description:: "Engine open-source. Especificación abierta. Sin lock-in. Confianza por transparencia."
* <!-- _NN Organizational values: --> Templates as products
weight:: 90
description:: "Cada template es un producto. Público propio. Monetización propia. El engine es infraestructura."
* <!-- _NN Organizational values: --> Dogfood todo
weight:: 80
description:: "Modelamos innV0 con Business Template. Documentamos nuestros procesos con Procedures Template."
* <!-- _NN Organizational values: --> Privacidad es feature
weight:: 85
description:: "Local-first. Sin telemetría sin permiso. Controles enterprise para gobierno de datos."

# <!-- _NN --> Organizational goals

* <!-- _NN Organizational goals: --> 10K GitHub stars Year 1
weight:: 80
metric:: "GitHub stars"
* <!-- _NN Organizational goals: --> Business Cloud beta Year 1
weight:: 95
metric:: "Beta lanzada"
* <!-- _NN Organizational goals: --> Procedures Cloud beta Year 2
weight:: 85
metric:: "Beta lanzada"
* <!-- _NN Organizational goals: --> 50 equipos pagos Cloud Year 1 (ambas templates)
weight:: 85
metric:: "Paying teams"
* <!-- _NN Organizational goals: --> Enterprise GA Year 2
weight:: 80
metric:: "Enterprise release"
* <!-- _NN Organizational goals: --> Break-even Year 2
weight:: 90
metric:: "Revenue > costs"

# <!-- _NN --> Metrics

* <!-- _NN Metrics: --> MAU engine (gratis)
weight:: 80
target:: "Y1: 5K Â· Y2: 25K Â· Y3: 100K"
* <!-- _NN Metrics: --> Free → Paid conversion (por template)
weight:: 90
target:: "Business 2-3% Â· Procedures 4-5%"
* <!-- _NN Metrics: --> MRR combinado
weight:: 100
target:: "Y1: $4.8K Â· Y2: $62K Â· Y3: $290K"
* <!-- _NN Metrics: --> Churn mensual
weight:: 85
target:: "< 5% Business Â· < 4% Procedures"
* <!-- _NN Metrics: --> NPS por template
weight:: 70
target:: "> 40 ambas templates"

# <!-- _NN --> Milestones

* <!-- _NN Milestones: --> V_0-2-0 — Engine polish + graph view
weight:: 80
timeframe:: "Shipping"
* <!-- _NN Milestones: --> V_0-3-0 — AI agent skills
weight:: 75
timeframe:: "Shipping"
* <!-- _NN Milestones: --> V_0-4-0 — Business Cloud alpha
weight:: 95
timeframe:: "Q3 2026"
* <!-- _NN Milestones: --> V_0-5-0 — Business Cloud beta + billing
weight:: 90
timeframe:: "Q4 2026"
* <!-- _NN Milestones: --> V_1-1-0 — Procedures Cloud alpha
weight:: 85
timeframe:: "Q1 2027"
* <!-- _NN Milestones: --> V_2-0-0 — Enterprise Suite
weight:: 80
timeframe:: "Q2 2027"
* <!-- _NN Milestones: --> V_3-0-0 — Template Marketplace
weight:: 50
timeframe:: "Q4 2027"

# <!-- _NN --> Features

* <!-- _NN Features: --> Markdown Editor (engine)
weight:: 100
status:: "shipping"
* <!-- _NN Features: --> Graph Visualization (engine)
weight:: 85
status:: "shipping"
* <!-- _NN Features: --> Relational Matrix Grid (engine)
weight:: 90
status:: "shipping"
* <!-- _NN Features: --> Marker Scoring (engine)
weight:: 80
status:: "shipping"
* <!-- _NN Features: --> Version Bump (engine)
weight:: 75
status:: "shipping"
* <!-- _NN Features: --> Real-time Collaboration (Cloud)
weight:: 90
status:: "planned — ambas templates"
* <!-- _NN Features: --> AI Coherence Audits (Cloud — Business)
weight:: 85
status:: "planned — Business template"
* <!-- _NN Features: --> Procedure Approval Flow (Cloud — Procedures)
weight:: 80
status:: "planned — Procedures template"
* <!-- _NN Features: --> PDF/PPT Export (Cloud)
weight:: 70
status:: "planned — ambas templates"
* <!-- _NN Features: --> SSO / LDAP (Enterprise)
weight:: 80
status:: "planned — Enterprise"
* <!-- _NN Features: --> Custom Metamodel Builder (Enterprise)
weight:: 75
status:: "planned — Enterprise"

# <!-- _NN --> Roadmap

**Fase 1 — Engine + Comunidad (Actual):**
Consolidar el engine open-source. Crecimiento orgánico. Samples y documentación. Las templates Business y Procedures existen como archivos, el valor está en el engine.

**Fase 2 — Business Cloud (Q3 2026–Q1 2027):**
Primera línea de pago. Colaboración en tiempo real, AI audits, exportación. Monetizar la template con mayor mercado.

**Fase 3 — Procedures Cloud (Q1–Q2 2027):**
Segunda línea de pago. Aprovechar el engine existente. Público diferente, misma infraestructura cloud. Cross-sell desde Business.

**Fase 4 — Enterprise (Q2 2027+):**
Self-hosted, SSO, audit. Ambas templates como suite. Contratos anuales de alto valor.

**Fase 5 — Marketplace (Q4 2027+):**
Templates de terceros. Efectos de red. Comisión por venta.

# <!-- _NN --> Activities

* <!-- _NN Activities: --> Engine Development
weight:: 100
frequency:: "continuo"
* <!-- _NN Activities: --> Business Template Cloud Development
weight:: 95
frequency:: "continuo (post-engine)"
* <!-- _NN Activities: --> Procedures Template Cloud Development
weight:: 80
frequency:: "continuo (post-Business)"
* <!-- _NN Activities: --> Content Marketing (dual: Business + Procedures)
weight:: 80
frequency:: "semanal"
* <!-- _NN Activities: --> Community Management
weight:: 70
frequency:: "diario"
* <!-- _NN Activities: --> Enterprise Sales
weight:: 65
frequency:: "desde Year 2"

# <!-- _NN --> Resources

* <!-- _NN Resources: --> FORMAT Engine (open source)
weight:: 100
type:: "intelectual"
* <!-- _NN Resources: --> Business Template (especificación + docs)
weight:: 90
type:: "intelectual"
* <!-- _NN Resources: --> Procedures Template (especificación + docs)
weight:: 85
type:: "intelectual"
* <!-- _NN Resources: --> AI Agent Skills
weight:: 80
type:: "intelectual"
* <!-- _NN Resources: --> GitHub Community
weight:: 70
type:: "comunidad"

# <!-- _NN --> Functions

* <!-- _NN Functions: --> Product Engineering (engine + templates)
weight:: 100
* <!-- _NN Functions: --> Cloud Platform Engineering
weight:: 85
* <!-- _NN Functions: --> Developer Relations
weight:: 70
* <!-- _NN Functions: --> Marketing & Growth (multi-template)
weight:: 75
* <!-- _NN Functions: --> Enterprise Sales
weight:: 60

# <!-- _NN --> Positions

* <!-- _NN Positions: --> Founder / Full-Stack
weight:: 100
status:: "filled"
* <!-- _NN Positions: --> Cloud Backend Engineer
weight:: 80
hiring:: "Year 2"
* <!-- _NN Positions: --> Marketing & Community
weight:: 70
hiring:: "Year 2"

# <!-- _NN --> Assumptions

* <!-- _NN Assumptions: --> Engine gratuito genera adopción orgánica suficiente
weight:: 90
certainty:: 70
validation:: "Traction actual en GitHub y crecimiento orgánico lo respaldan"
* <!-- _NN Assumptions: --> 2-3% de usuarios Business se convierten a Cloud
weight:: 80
certainty:: 40
validation:: "Benchmark de freemium SaaS. Business tiene ciclo de evaluación más largo."
* <!-- _NN Assumptions: --> 4-5% de usuarios Procedures se convierten a Cloud
weight:: 75
certainty:: 45
validation:: "Necesidad más inmediata (compliance, auditoría) debería dar mejor conversión."
* <!-- _NN Assumptions: --> Enterprise paga $10K-$100K/año por suite
weight:: 75
certainty:: 30
validation:: "Comparable a Confluence y LucidChart. Validar con conversaciones."

# <!-- _NN --> Risks

* <!-- _NN Risks: --> Cloud no gana tracción
weight:: 80
severity:: high
mitigation:: "Beta con usuarios antes de build completo. Engine free como fallback."
contingency:: "Pivot a consultoría usando el engine como diferenciador."
* <!-- _NN Risks: --> Dos templates diluyen foco
weight:: 75
severity:: medium
mitigation:: "Priorizar Business Cloud. Procedures Cloud después de validar Business."
* <!-- _NN Risks: --> Enterprise sales cycle muy largo para bootstrapped
weight:: 70
severity:: medium
mitigation:: "Cloud self-serve primero. Enterprise desde Year 2."
contingency:: "Seed round para equipo de ventas enterprise."
* <!-- _NN Risks: --> Competidor grande copia el patrón
weight:: 60
severity:: medium
mitigation:: "Open-source spec crea network effects. Comunidad > feature set."

# <!-- _NN --> SWOT

**Strengths:**
- Engine open-source, local-first (trust advantage)
- Dos templates cubren mercados distintos con mismo backend
- Dogfooded — usamos FORMAT para modelar FORMAT
- AI agent skills para creación asistida de modelos
- Estructura de costos baja (bootstrapped)

**Weaknesses:**
- Single founder (key-person risk)
- Sin revenue todavía (pre-monetización)
- Cloud tiers sin construir
- Dos productos para una sola persona

**Opportunities:**
- Adopción masiva de IA creando demanda de contexto estructurado
- Compliance y regulaciones impulsando necesidad de trazabilidad
- Consulting firms necesitando multi-cliente
- Template marketplace como efecto de red futuro

**Threats:**
- Notion/Confluence agregando features de IA
- File System API limitado (no Firefox/Safari)
- Ciclos enterprise largos drenando recursos

# <!-- _NN --> Unfair advantage

**El moat no es el engine — es el ecosistema de templates.**

Cada template que creamos (Business, Procedures, futuras) es un producto independiente con su propio mercado. Pero comparten un engine común, una especificación abierta, y una comunidad. Esto crea un efecto de red en la capa de formato, no en la capa de plataforma.

Cuanto más adopta la gente FORMAT para distintas necesidades (estrategia, procesos, compliance), más valioso se vuelve el ecosistema. Y como la especificación es abierta, cualquiera puede crear templates — pero nosotros somos quienes definimos las oficiales y construimos el Cloud alrededor de ellas.

# <!-- _NN matrices: --> item-markers matrix

| Item \ Marker | weight | completion | certainty | priority | rating |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Strategy Founders (Business Template) | - | - | - | - | - |
| Strategy Consultants (Business Template) | - | - | - | - | - |
| Product Managers (Business Template) | - | - | - | - | - |
| Engineering Leads (Procedures Template) | - | - | - | - | - |
| Ops & Compliance Teams (Procedures Template) | - | - | - | - | - |
| Enterprise Decision Makers (ambos) | - | - | - | - | - |
| Open Source Community | - | - | - | - | - |
| Core Team (innV0) | - | - | - | - | - |
| Founders & Solopreneurs (Business) | - | - | - | - | - |
| SMB Strategy Teams (Business) | - | - | - | - | - |
| Consultancies (Business) | - | - | - | - | - |
| Engineering Teams (Procedures) | - | - | - | - | - |
| Ops & Compliance (Procedures) | - | - | - | - | - |
| Enterprise (ambas templates) | - | - | - | - | - |
| Template Creators (ecosistema futuro) | - | - | - | - | - |
| Solo técnico, pre-seed, 25-40 años, $0-$50/mes | - | - | - | - | - |
| Consultor estratégico, MBA, 30-55 años, $100-$500/mes | - | - | - | - | - |
| Líder de ops, 30-50 años, industria regulada, $50-$200/mes | - | - | - | - | - |
| Engineering manager, 28-45 años, técnico, $20-$100/mes | - | - | - | - | - |
| Enterprise architect, 40-60 años, C-level/VP, $10K-$100K/año | - | - | - | - | - |
| Por Plantilla (línea de negocio) | - | - | - | - | - |
| Por Tamaño de Organización | - | - | - | - | - |
| Por Madurez Técnica | - | - | - | - | - |
| Por Industria | - | - | - | - | - |
| IA necesita contexto estructurado | - | - | - | - | - |
| Knowledge management se fusiona con IA | - | - | - | - | - |
| Open-source / local-first como ventaja | - | - | - | - | - |
| Procesos como código | - | - | - | - | - |
| Fragmentación de herramientas | - | - | - | - | - |
| Strategyzer / Canvanizer (Business) | - | - | - | - | - |
| Notion / Confluence (ambas) | - | - | - | - | - |
| Miro / Mural (Business) | - | - | - | - | - |
| Process.st / SweetProcess (Procedures) | - | - | - | - | - |
| Confluence Whiteboards (Procedures) | - | - | - | - | - |
| IA no tiene contexto de negocio | - | - | - | - | - |
| Fragmentación de información estratégica | - | - | - | - | - |
| Procedimientos no documentados (conocimiento tribal) | - | - | - | - | - |
| Modelos de negocio estáticos | - | - | - | - | - |
| Sin validación de coherencia | - | - | - | - | - |
| Compliance y auditoría sin trazabilidad | - | - | - | - | - |
| Engine FORMAT gratis + open-source | - | - | - | - | - |
| Business Template: Un archivo = contexto IA completo | - | - | - | - | - |
| Procedures Template: Procesos como código | - | - | - | - | - |
| Estrategia versionada (Business) | - | - | - | - | - |
| Coherencia automatizada (Business) | - | - | - | - | - |
| Matrices relacionales (Business) | - | - | - | - | - |
| Trazabilidad regulatoria (Procedures) | - | - | - | - | - |
| Multi-cliente para consultoras (Business) | - | - | - | - | - |
| FORMAT Engine (Open Source) | - | - | - | - | - |
| Business Template Cloud | - | - | - | - | - |
| Procedures Template Cloud | - | - | - | - | - |
| Enterprise Suite | - | - | - | - | - |
| Professional Services | - | - | - | - | - |
| Template Marketplace (futuro) | - | - | - | - | - |
| Engine (Open Source) | - | - | - | - | - |
| Business Starter | - | - | - | - | - |
| Business Professional | - | - | - | - | - |
| Procedures Standard | - | - | - | - | - |
| Procedures Professional | - | - | - | - | - |
| Consulting | - | - | - | - | - |
| Enterprise Licenses | - | - | - | - | - |
| Marketplace Commissions | - | - | - | - | - |
| Engineering (ambas templates + engine) | - | - | - | - | - |
| Cloud Infrastructure | - | - | - | - | - |
| Marketing & Growth | - | - | - | - | - |
| Design & UX | - | - | - | - | - |
| Operations | - | - | - | - | - |
| Dos productos que dividen atención | - | - | - | - | - |
| Adoption requiere cambio de hábito | - | - | - | - | - |
| Enterprise sales cycle largo | - | - | - | - | - |
| Single founder risk | - | - | - | - | - |
| Competencia indirecta de Notion/Confluence | - | - | - | - | - |
| Open by default | - | - | - | - | - |
| Templates as products | - | - | - | - | - |
| Dogfood todo | - | - | - | - | - |
| Privacidad es feature | - | - | - | - | - |
| 10K GitHub stars Year 1 | - | - | - | - | - |
| Business Cloud beta Year 1 | - | - | - | - | - |
| Procedures Cloud beta Year 2 | - | - | - | - | - |
| 50 equipos pagos Cloud Year 1 (ambas templates) | - | - | - | - | - |
| Enterprise GA Year 2 | - | - | - | - | - |
| Break-even Year 2 | - | - | - | - | - |
| MAU engine (gratis) | - | - | - | - | - |
| Free → Paid conversion (por template) | - | - | - | - | - |
| MRR combinado | - | - | - | - | - |
| Churn mensual | - | - | - | - | - |
| NPS por template | - | - | - | - | - |
| V_0-2-0 — Engine polish + graph view | - | - | - | - | - |
| V_0-3-0 — AI agent skills | - | - | - | - | - |
| V_0-4-0 — Business Cloud alpha | - | - | - | - | - |
| V_0-5-0 — Business Cloud beta + billing | - | - | - | - | - |
| V_1-1-0 — Procedures Cloud alpha | - | - | - | - | - |
| V_2-0-0 — Enterprise Suite | - | - | - | - | - |
| V_3-0-0 — Template Marketplace | - | - | - | - | - |
| Markdown Editor (engine) | - | - | - | - | - |
| Graph Visualization (engine) | - | - | - | - | - |
| Relational Matrix Grid (engine) | - | - | - | - | - |
| Marker Scoring (engine) | - | - | - | - | - |
| Version Bump (engine) | - | - | - | - | - |
| Real-time Collaboration (Cloud) | - | - | - | - | - |
| AI Coherence Audits (Cloud — Business) | - | - | - | - | - |
| Procedure Approval Flow (Cloud — Procedures) | - | - | - | - | - |
| PDF/PPT Export (Cloud) | - | - | - | - | - |
| SSO / LDAP (Enterprise) | - | - | - | - | - |
| Custom Metamodel Builder (Enterprise) | - | - | - | - | - |
| Engine Development | - | - | - | - | - |
| Business Template Cloud Development | - | - | - | - | - |
| Procedures Template Cloud Development | - | - | - | - | - |
| Content Marketing (dual: Business + Procedures) | - | - | - | - | - |
| Community Management | - | - | - | - | - |
| Enterprise Sales | - | - | - | - | - |
| Business Template (especificación + docs) | - | - | - | - | - |
| Procedures Template (especificación + docs) | - | - | - | - | - |
| AI Agent Skills | - | - | - | - | - |
| GitHub Community | - | - | - | - | - |
| Product Engineering (engine + templates) | - | - | - | - | - |
| Cloud Platform Engineering | - | - | - | - | - |
| Developer Relations | - | - | - | - | - |
| Marketing & Growth (multi-template) | - | - | - | - | - |
| Founder / Full-Stack | - | - | - | - | - |
| Cloud Backend Engineer | - | - | - | - | - |
| Marketing & Community | - | - | - | - | - |
| Lead Maintainer | - | - | - | - | - |
| Engine gratuito genera adopción orgánica suficiente | - | - | - | - | - |
| 2-3% de usuarios Business se convierten a Cloud | - | - | - | - | - |
| 4-5% de usuarios Procedures se convierten a Cloud | - | - | - | - | - |
| Enterprise paga $10K-$100K/año por suite | - | - | - | - | - |
| Cloud no gana tracción | - | - | - | - | - |
| Dos templates diluyen foco | - | - | - | - | - |
| Enterprise sales cycle muy largo para bootstrapped | - | - | - | - | - |
| Competidor grande copia el patrón | - | - | - | - | - |

# <!-- _NN matrices: --> metamatrix

| Matrix Name | Source | Target | Widget Type | Widget Parameters |
| :--- | :--- | :--- | :--- | :--- |
| Journey map | Journey | Emotions | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| Segmentation-Profiles Matrix | Segmentation | Profiles | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| Problems-Value propositions Matrix | Problems | Value propositions | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| Value propositions-Messages Matrix | Value propositions | Messages | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| Messages-Channels Matrix | Messages | Channels | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| Features-Milestones Matrix | Features | Milestones | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| Activities-Resources Matrix | Activities | Resources | cycle | Max;Very High;High;Slightly High;Neutral;Slightly Low;Low;Very Low;Min |
| item-markers matrix | elements | markers | cycle | - |

# <!-- _NN matrices: --> journey map

| Journey \ Emotions |  |
| :--- |  |

# <!-- _NN matrices: --> segmentation-profiles matrix

| Segmentation \ Profiles | Solo técnico, pre-seed, 25-40 años, $0-$50/mes | Consultor estratégico, MBA, 30-55 años, $100-$500/mes | Líder de ops, 30-50 años, industria regulada, $50-$200/mes | Engineering manager, 28-45 años, técnico, $20-$100/mes | Enterprise architect, 40-60 años, C-level/VP, $10K-$100K/año |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Por Plantilla (línea de negocio) | - | - | - | - | - |
| Por Tamaño de Organización | - | - | - | - | - |
| Por Madurez Técnica | - | - | - | - | - |
| Por Industria | - | - | - | - | - |

# <!-- _NN matrices: --> problems-value propositions matrix

| Problems \ Value propositions | Engine FORMAT gratis + open-source | Business Template: Un archivo = contexto IA completo | Procedures Template: Procesos como código | Estrategia versionada (Business) | Coherencia automatizada (Business) | Matrices relacionales (Business) | Trazabilidad regulatoria (Procedures) | Multi-cliente para consultoras (Business) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| IA no tiene contexto de negocio | - | - | - | - | - | - | - | - |
| Fragmentación de información estratégica | - | - | - | - | - | - | - | - |
| Procedimientos no documentados (conocimiento tribal) | - | - | - | - | - | - | - | - |
| Modelos de negocio estáticos | - | - | - | - | - | - | - | - |
| Sin validación de coherencia | - | - | - | - | - | - | - | - |
| Compliance y auditoría sin trazabilidad | - | - | - | - | - | - | - | - |

# <!-- _NN matrices: --> value propositions-messages matrix

| Value propositions \ Messages |  |
| :--- |  |
| Engine FORMAT gratis + open-source |  |
| Business Template: Un archivo = contexto IA completo |  |
| Procedures Template: Procesos como código |  |
| Estrategia versionada (Business) |  |
| Coherencia automatizada (Business) |  |
| Matrices relacionales (Business) |  |
| Trazabilidad regulatoria (Procedures) |  |
| Multi-cliente para consultoras (Business) |  |

# <!-- _NN matrices: --> messages-channels matrix

| Messages \ Channels |  |
| :--- |  |

# <!-- _NN matrices: --> features-milestones matrix

| Features \ Milestones | V_0-2-0 — Engine polish + graph view | V_0-3-0 — AI agent skills | V_0-4-0 — Business Cloud alpha | V_0-5-0 — Business Cloud beta + billing | V_1-1-0 — Procedures Cloud alpha | V_2-0-0 — Enterprise Suite | V_3-0-0 — Template Marketplace |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Markdown Editor (engine) | - | - | - | - | - | - | - |
| Graph Visualization (engine) | - | - | - | - | - | - | - |
| Relational Matrix Grid (engine) | - | - | - | - | - | - | - |
| Marker Scoring (engine) | - | - | - | - | - | - | - |
| Version Bump (engine) | - | - | - | - | - | - | - |
| Real-time Collaboration (Cloud) | - | - | - | - | - | - | - |
| AI Coherence Audits (Cloud — Business) | - | - | - | - | - | - | - |
| Procedure Approval Flow (Cloud — Procedures) | - | - | - | - | - | - | - |
| PDF/PPT Export (Cloud) | - | - | - | - | - | - | - |
| SSO / LDAP (Enterprise) | - | - | - | - | - | - | - |
| Custom Metamodel Builder (Enterprise) | - | - | - | - | - | - | - |

# <!-- _NN matrices: --> activities-resources matrix

| Activities \ Resources | FORMAT Engine (open source) | Business Template (especificación + docs) | Procedures Template (especificación + docs) | AI Agent Skills | GitHub Community |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Engine Development | - | - | - | Very High | Very High |
| Business Template Cloud Development | - | - | - | - | - |
| Procedures Template Cloud Development | - | - | - | - | - |
| Content Marketing (dual: Business + Procedures) | - | - | - | - | - |
| Community Management | - | - | - | Very High | Max |
| Enterprise Sales | - | - | - | - | - |

# <!-- _NN matrices: --> item-markers matrix

| elements \ markers |  |
| :--- |  |