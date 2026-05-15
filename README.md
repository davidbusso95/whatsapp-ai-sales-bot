# whatsapp-ai-sales-bot-backend

Backend MVP para un bot de ventas por WhatsApp orientado a negocios que reciben consultas y pedidos por WhatsApp.

El proyecto recibe mensajes desde WhatsApp Cloud API, consulta productos en Airtable, genera respuestas breves con OpenAI y registra clientes, conversaciones y pedidos. Está pensado como base funcional y como caso de portfolio profesional listo para desplegar en Railway.

## Stack

- Node.js
- Express
- Axios
- Dotenv
- CORS
- WhatsApp Cloud API de Meta
- Airtable REST API
- OpenAI API
- Railway

## Funcionalidades

- Webhook de verificación para Meta.
- Recepción de mensajes entrantes de WhatsApp.
- Procesamiento de mensajes de texto.
- Respuestas automáticas por WhatsApp.
- Respuestas inteligentes con OpenAI.
- Consulta de productos disponibles desde Airtable.
- Registro y actualización de clientes.
- Registro de conversaciones.
- Creación básica de pedidos cuando se detecta intención de compra.
- Detección de intención de hablar con humano.
- Escalado a atención humana.
- Endpoints de prueba para WhatsApp, Airtable y OpenAI.
- Configuración por variables de entorno.

## Estructura

```txt
whatsapp-ai-sales-bot-backend/
├── server.js
├── package.json
├── .env.example
├── README.md
├── routes/
│   ├── webhook.routes.js
│   └── test.routes.js
├── controllers/
│   ├── webhook.controller.js
│   └── test.controller.js
├── services/
│   ├── whatsapp.service.js
│   ├── openai.service.js
│   ├── airtable.service.js
│   └── conversation.service.js
├── utils/
│   ├── logger.js
│   ├── messageParser.js
│   └── validators.js
└── config/
    └── env.js
```

## Variables de entorno

Creá un archivo `.env` en la raíz usando `.env.example` como base:

```env
PORT=3000
VERIFY_TOKEN=your_meta_verify_token
WHATSAPP_TOKEN=your_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v21.0
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_PRODUCTS_TABLE=Productos
AIRTABLE_CUSTOMERS_TABLE=Clientes
AIRTABLE_ORDERS_TABLE=Pedidos
AIRTABLE_CONVERSATIONS_TABLE=Conversaciones
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
BUSINESS_NAME=Demo Food
BUSINESS_DESCRIPTION=Negocio de comida rápida con atención por WhatsApp
```

El servidor muestra warnings si faltan variables críticas, pero no se rompe en desarrollo.

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm run dev
```

```bash
npm start
```

Por defecto corre en `http://localhost:3000`.

## Endpoints

### Health check

```http
GET /health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "message": "WhatsApp AI Sales Bot backend running"
}
```

### Test route

```http
GET /test
```

### Enviar mensaje de prueba

```http
POST /test/send-message
Content-Type: application/json
```

```json
{
  "to": "549XXXXXXXXXX",
  "message": "Mensaje de prueba"
}
```

### Consultar productos

```http
GET /test/products
```

### Probar respuesta IA

```http
POST /test/ai
Content-Type: application/json
```

```json
{
  "message": "Hola, qué productos tienen?"
}
```

## Configurar webhook en Meta

1. Creá o abrí una app en Meta for Developers.
2. Agregá el producto WhatsApp.
3. Configurá el webhook con la URL pública:

```txt
https://TU-DOMINIO.up.railway.app/webhook
```

4. Usá el mismo valor de `VERIFY_TOKEN` que configuraste en Railway.
5. Suscribí el webhook al evento `messages`.
6. Verificá que Meta reciba el `hub.challenge` correctamente.

## Configurar Airtable

Creá una base con estas tablas y campos:

### Productos

- `nombre`
- `categoria`
- `precio`
- `descripcion`
- `disponible`

### Clientes

- `telefono`
- `nombre`
- `ultima_interaccion`

### Pedidos

- `telefono`
- `nombre_cliente`
- `detalle_pedido`
- `total_estimado`
- `direccion`
- `metodo_pago`
- `estado`

### Conversaciones

- `telefono`
- `ultimo_mensaje`
- `estado`
- `requiere_humano`
- `fecha`

En Airtable, asegurate de que `disponible` sea un checkbox o un campo compatible con booleano.

## Deploy en Railway

1. Subí el proyecto a GitHub.
2. Creá un nuevo proyecto en Railway desde el repositorio.
3. Configurá las variables de entorno del archivo `.env.example`.
4. Railway detectará Node.js y ejecutará:

```bash
npm start
```

5. Copiá la URL pública generada por Railway y usala para configurar el webhook de Meta.

## Ideas futuras

- Memoria conversacional.
- Dashboard operativo.
- Panel multi-cliente.
- Integración con pagos.
- Envío automático de pedido al dueño.
- Plantillas de WhatsApp.
- Analytics.

## Notas

Esta versión implementa una base sólida para mensajes de texto. No incluye todavía templates, botones, listas, pagos, audios, imágenes ni multiusuario complejo.
