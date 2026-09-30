---
layout: default
title: Cognitive Ecosystem — External Tooling & Integrations
description: Arquitectura de integración de herramientas independientes en cogNNitive, analizando el caso de estudio de generación de imágenes con WaveSpeed (MCP frente a CLI).
---

# Cognitive Ecosystem & External Tooling

El ecosistema **cogNNitive** está diseñado con una arquitectura modular y desacoplada centrada en el conocimiento estructurado (**iNNfo**) y las capacidades de los agentes de IA (**ageNNt**). Para conocer el ciclo de vida completo de la información (`IMPORT` ➔ `MANAGE` ➔ `EXPORT` + Feedback Loop), consulta el [**Lifecycle Walkthrough**](lifecycle-walkthrough.md).

Este documento explora la integración con herramientas y servicios externos independientes mediante casos de estudio prácticos (como renderizado multimedia con WaveSpeed).

---

## 1. Filosofía de Integración: Núcleo Desacoplado y Herramientas Externas

En una plataforma de conocimiento vivo, el procesamiento lógico de modelos y especificaciones reside en el motor local (`innfo-core` y `innfo-mcp`), mientras que las capacidades pesadas de cómputo en la nube (como renderizado gráfico, síntesis de voz, generación de vídeo o modelos 3D) se delegan en servicios especializados de terceros.

Para conectar estas capacidades con nuestros agentes de IA (en OpenCode, Claude Desktop, Cursor, etc.), existen fundamentalmente dos aproximaciones técnicas: **Model Context Protocol (MCP)** y **Command Line Interface (CLI)**.

---

## 2. Caso de Estudio: Generación de Imágenes con WaveSpeed

WaveSpeed (`wavespeed.ai`) provee una plataforma en la nube para ejecutar modelos generativos en catálogo abierto (imagen, vídeo, audio, 3D). Analizaremos las dos alternativas para integrarlo en el flujo de trabajo de Cognnitive.

### Opción A: WaveSpeed MCP (Recomendado)
El servidor MCP oficial (`@wavespeed/mcp`) expone las capacidades de WaveSpeed directamente como herramientas nativas al agente de IA (ej. `list_models`, `run_model`, `get_price`, `get_model_schema`).

* **Cómo funciona:** El servidor corre como un proceso hijo independiente gestionado por el cliente de IA (configurado globalmente en `mcp.json`). Cuando el usuario solicita generar una imagen, el agente realiza introspección de esquemas del modelo, evalúa precios o parámetros y ejecuta la llamada de forma autónoma y estructurada mediante JSON-RPC.

### Opción B: WaveSpeed CLI (`@wavespeed/cli`)
El paquete de línea de comandos tradicional que permite ejecutar tareas mediante la terminal (`wavespeed run ...`).

* **Cómo funciona:** El agente o un script de shell ejecuta comandos monolíticos en la terminal del sistema operativo, parseando la salida estándar (stdout/stderr).

---

## 3. Análisis Comparativo: MCP vs. CLI

| Eje de Evaluación | WaveSpeed MCP (Opción A) | WaveSpeed CLI (Opción B) |
| :--- | :--- | :--- |
| **Interoperabilidad Multi-Agente** | **Nativa y Estructurada:** Soportada automáticamente en OpenCode, Claude Desktop, Cursor, Cline y Roo Code con un único archivo de configuración (`mcp.json`). | **Limitada para Agentes Conversacionales:** Requiere que el agente ejecute comandos de shell y maneje salidas de texto de forma heurística, sin tipado estricto de herramientas (*tool use*). |
| **Complejidad de Instalación** | Se instala de forma global vía `npx` o paquete de Node y se declara en la configuración del cliente. | Requiere instalación global del CLI (`npm install -g @wavespeed/cli`) y wrappers de automatización en shell. |
| **Autonomía del Modelo (IA)** | **Alta:** El modelo de lenguaje lee los esquemas de entrada antes de escribir la solicitud, validando parámetros y evitando errores de sintaxis. | **Baja/Media:** Depende de la destreza del agente construyendo argumentos de comandos en la terminal de texto. |
| **Seguridad de la Clave API** | Aislada en el entorno de ejecución del proceso MCP o inyectada por el cliente de IA mediante la propiedad `env` del archivo `mcp.json`. | Expuesta en variables de entorno de la sesión de shell o pasada por argumentos de comandos. |
| **Control de Costes y Precios** | Acceso a herramientas de introspección de precios (`get_price`) previas a la ejecución del modelo. | Ejecución directa sin pre-validación estructurada de costes a menos que se implemente script adicional. |

---

## 4. Recomendación Arquitectónica para Cognnitive

Para el desarrollo dentro de **Cognnitive**, la recomendación definitiva es **adoptar WaveSpeed MCP** como estándar para los flujos asistidos por IA.

### Razones clave:
1. **Autonomía guiada por esquemas:** Al utilizar MCP, el agente no adivina los parámetros que acepta un modelo en la nube; consulta dinámicamente el esquema en vivo (`get_model_schema`), garantizando que la generación de recursos gráficos cumpla exactamente con lo esperado.
2. **Centralización multi-cliente:** Configurar el servidor en `C:\Users\<usuario>\.opencode\mcp.json` (o equivalente en otros clientes) permite compartir la herramienta de generación gráfica instantáneamente en cualquier proyecto del monorepo sin duplicar código ni dependencias.
3. **Respeto por el paradigma de seguridad:** La separación de procesos mediante el protocolo MCP aísla la lógica de red y las credenciales de API del código fuente de la aplicación principal.
