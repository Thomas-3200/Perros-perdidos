# Guia de Prueba — Perros Perdidos App

Gracias por ser parte de este piloto. Tu experiencia real como usuario es lo que necesitamos para mejorar la app antes del lanzamiento oficial.

## Que hace la app

Perros Perdidos es una plataforma para ayudar a reunir perros perdidos con sus duenos. Cualquier persona puede reportar un perro perdido, reportar un avistamiento, y el sistema cruza automaticamente esa informacion para generar posibles coincidencias.

## Que estamos probando

Queremos saber si los formularios son claros, si el flujo de busqueda tiene sentido, y si algo te confunde, falla, o hace falta. No hay respuestas incorrectas — cada problema que encuentres es informacion valiosisima.

La app corre en: **http://localhost:3002**

---

## 1. Como registrarse

No hay contrasena. Solo necesitas tu correo electronico.

1. Entra a la app y hace clic en **Iniciar sesion** o en cualquier accion que lo pida.
2. Escribi tu correo electronico y hace clic en **Continuar**.
3. Revisa tu bandeja de entrada — vas a recibir un correo con un enlace o codigo de acceso.
4. Hace clic en el enlace (o pega el codigo en la app) y listo, ya estas adentro.

No hace falta crear una cuenta con datos adicionales. El correo es suficiente.

---

## 2. Como reportar un perro perdido

Ir a **/reportar/perdido** o usar el boton principal en la pantalla de inicio.

El formulario tiene 4 pasos:

**Paso 1 — Datos del perro**
Nombre, raza, color, tamano, edad aproximada y cualquier senal particular (collar, manchas, cicatrices). Cuanto mas detalle, mejor.

**Paso 2 — Ubicacion**
Indica donde se perdio el perro. Tip: usa el boton de GPS para que la app tome tu ubicacion actual automaticamente — es mas preciso que escribir la direccion a mano. Si sabes la zona pero no la calle exacta, pone el barrio o referencia cercana.

**Paso 3 — Contacto**
Tu nombre y como queres que te contacten (WhatsApp, telefono). Este dato se muestra a quienes vean el caso.

**Paso 4 — Fotos**
Subi al menos una foto clara del perro. Tip: una foto de frente y una de perfil ayudan mucho al sistema para encontrar coincidencias. Evita fotos borrosas o muy oscuras.

Al terminar, el caso queda publicado en el feed principal.

---

## 3. Como reportar un avistamiento

Si viste un perro suelto que podria estar perdido, podes reportarlo aunque no sepas de quien es. Eso ayuda a que el dueno lo encuentre.

Ir a **/reportar/avistamiento**. El formulario tiene 3 pasos:

**Paso 1 — Ubicacion**
Donde lo viste. De nuevo, el boton de GPS es tu mejor opcion. Si ya no estas en el lugar, indica la calle o referencia lo mas preciso posible.

**Paso 2 — Descripcion**
Color, tamano, raza aproximada, si tenia collar, como se comportaba (asustado, amigable, herido). Todo suma.

**Paso 3 — Estado**
Selecciona si el perro sigue en el lugar, si ya no estaba cuando te fuiste, o si lo tenes en custodia temporal.

El avistamiento queda registrado y el sistema lo cruza automaticamente con los casos activos de perros perdidos.

---

## 4. Como revisar coincidencias

Cuando entras al detalle de un caso (**/casos/[id]**), vas a ver una seccion de **Posibles coincidencias**.

Cada coincidencia tiene un nivel de confianza:

- **ALTA** — El sistema encontro multiples caracteristicas en comun (ubicacion cercana, color, tamano, raza). Vale la pena contactar al reportador.
- **MEDIA** — Hay similitudes parciales. Puede ser el perro, pero hay incertidumbre. Revisa las fotos y descripciones antes de contactar.

Las coincidencias no son garantia — son pistas. El paso final siempre lo da una persona.

---

## 5. Como contactar al dueno o al reportador

En la pagina de detalle del caso, abajo de la descripcion y las coincidencias, hay un boton de **WhatsApp** o **Llamar** con los datos de contacto que la persona cargo.

Hace clic en el boton correspondiente. Se abre WhatsApp (o el marcador) directamente con el numero cargado.

Si el numero de WhatsApp no abre bien o el boton no funciona, anotalo como feedback.

---

## 6. Que hacer si encontraron al perro

Por ahora, marcar un caso como "Encontrado" se hace de forma manual a traves del equipo de administracion. Si el perro fue reunido con su dueno:

1. Escribinos a **pilot@perrosperdidos.app** indicando el ID del caso (lo ves en la URL: `/casos/[id]`).
2. Le damos el cierre al caso desde el panel de administracion.

Estamos trabajando para que esto se pueda hacer directamente desde la app en la proxima version.

---

## Otras secciones de la app

- **Inicio (/)** — Feed con todos los casos activos. Podes ver los mas recientes.
- **Buscar (/buscar)** — Filtra casos por ciudad.
- **Mi perfil (/perfil)** — Tus casos reportados y tus datos.
- **Apoyo (/apoyo)** — Seccion de contension emocional. Dice "Proximamente" — es normal, aun no esta activa.

---

## Como reportar feedback

Eso es lo mas importante de esta etapa. Queremos saber:

- Algo que no entendiste o te confundio
- Un paso que fallo o no hizo lo que esperabas
- Algo que faltaria para que la app sea mas util
- Cualquier error, pantalla rota, o comportamiento extrano

**Escribinos a:** pilot@perrosperdidos.app

Podes mandarnos un mensaje de WhatsApp tambien — el numero lo recibiste junto con esta guia.

No hace falta que sea un reporte formal. Un mensaje corto como "no entendi para que sirve el paso 3 del formulario" ya nos ayuda un monton.

Gracias por tu tiempo y por ayudar a que mas perros vuelvan a casa.
