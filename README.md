# MAMB - Museo Artistico Interactivo

Proyecto MAMB - Universidad Simon Bolivar  
Ingenieria de Sistemas - Tecnologias Web

## Estructura

```text
mamb-interactivo/
├── public/
│   ├── css/style.css
│   ├── js/app.js
│   ├── my_model/                 Modelo local de Teachable Machine
│   ├── vendor/                   Librerias locales de TensorFlow/Teachable Machine
│   ├── index.html                Pagina principal del museo
│   └── interactivo.html          App interactiva
├── uploads/                      Obras guardadas
├── db.json                       Datos de la galeria
├── server.js                     Servidor Node nativo
├── package.json
└── README.md
```

## Pasos para ejecutar la aplicación

Abre una terminal en esta carpeta y ejecuta:

```bash
npm start
```

Luego abre:

- Sitio web principal: http://localhost:3000/
- App interactiva: http://localhost:3000/interactivo.html
- API status: http://localhost:3000/api/status

No se requiere `npm install`; el servidor usa modulos nativos de Node.

## Funcionamiento

La app interactiva carga un modelo local de Teachable Machine desde `public/my_model`.
El analisis ocurre en el navegador con TensorFlow.js y las obras se guardan en el servidor local.

Flujo:

```text
Inicio -> Escanear dibujo -> Formulario -> Transformando -> Resultado -> Guardar -> Galeria
```

## Equipo

- Adriano Aragon
- Sebastian Blanco
- Santiago Perez
- Ney Salazar

Universidad Simon Bolivar - Barranquilla Colombia
