# Plan de Pilot — Perros Perdidos MVP v1.0

**Fecha:** 2026-04-29
**Estado del MVP:** 12/12 smoke tests passing. Listo para pilot controlado.

---

## 1. Objetivo del Pilot

Queremos responder tres preguntas concretas antes de escalar:

1. **¿El flujo central funciona?** Un dueño que perdió su perro puede reportar el caso, recibir un match con un avistamiento, y contactar al avistador — sin ayuda externa.
2. **¿La UX es tolerable bajo estrés?** Un dueño desesperado no tiene paciencia para formularios confusos. ¿Llegan al final o abandonan?
3. **¿El matching genera señal útil?** ¿Los matches HIGH/MEDIUM son relevantes, o son ruido que frustra?

Lo que NO queremos medir todavía: escala, viralidad, monetización. Esto es una prueba de que el loop funciona.

---

## 2. Alcance

| Parámetro       | Valor                                                                 |
|-----------------|-----------------------------------------------------------------------|
| Usuarios        | 10–20 personas (mix: dueños con perros perdidos recientes + rescatistas activos) |
| Duración        | 2–3 semanas                                                           |
| Geografía       | Una ciudad/barrio específico (Buenos Aires como primera opción)       |
| Reclutamiento   | Invitación directa únicamente — sin publicidad ni redes sociales      |
| Acceso          | Cuenta creada manualmente por admin para cada usuario pilot           |

Perfil de usuarios buscados:
- Personas que hayan perdido o encontrado un perro en los últimos 6 meses (tienen contexto real)
- Rescatistas independientes o de ONG pequeñas con actividad en CABA/GBA
- Disposición a dar feedback honesto (no validadores sociales)

---

## 3. Checklist Antes de Invitar Usuarios

Completar todo antes de enviar la primera invitación.

| Item                                                   | Estado         |
|--------------------------------------------------------|----------------|
| DB limpia, sin datos de prueba                         | Completado     |
| 12/12 smoke tests passing                              | Completado     |
| Usuario admin configurado (admin@perrosperdidos.app)   | Completado     |
| Al menos 1 moderador designado (persona real)          | Pendiente      |
| Canal de feedback establecido (email/WhatsApp/form)    | Pendiente      |
| Server accesible desde fuera de localhost              | **Pendiente — bloqueante** |
| Backup plan si el server cae                           | Pendiente      |
| SLA interno: revisión de matches MEDIUM en <= 4 horas  | Pendiente      |
| Instrucciones de onboarding redactadas para usuarios   | Pendiente      |

El item de server es bloqueante: actualmente corre en localhost. Antes del pilot hay que levantar en una URL pública (VPS, Railway, Render, o similar) o al menos en red compartida con acceso estable.

---

## 4. Métricas a Medir

### Métricas cuantitativas (seguimiento semanal)

| Métrica                                             | Cómo medirla                              |
|-----------------------------------------------------|-------------------------------------------|
| Casos reportados por semana                         | Admin panel / query DB                    |
| Avistamientos reportados por semana                 | Admin panel / query DB                    |
| Matches generados (HIGH vs MEDIUM)                  | Admin panel                               |
| Matches confirmados por dueños                      | Campo de estado en caso                   |
| Matches rechazados por dueños                       | Campo de estado en caso                   |
| Tiempo hasta primer match (desde creación del caso) | Timestamp caso vs timestamp primer match  |
| Reunificaciones confirmadas                         | **Métrica dorada** — marcado por admin    |

### Métricas cualitativas

- Tasa de abandono en formulario de reporte (si hay logs de navegación)
- Errores reportados por usuarios
- Confusiones recurrentes en el flujo

---

## 5. Riesgos Conocidos

Lista honesta. No hay sorpresas si se documenta antes.

| Riesgo                                              | Impacto    | Mitigación durante pilot                              |
|-----------------------------------------------------|------------|-------------------------------------------------------|
| Imágenes en localStorage del server — si el proceso se reinicia, las fotos se pierden | Alto | Avisar a usuarios; el admin hace backup manual periódico |
| Sin push notifications reales (FCM no integrado)    | Medio      | Notificación por email o WhatsApp manual desde admin  |
| Matching básico puede generar falsos MEDIUM          | Medio      | Moderador revisa todos los MEDIUM antes de notificar  |
| Usuarios bajo estrés con poca tolerancia a fricciones | Alto     | Onboarding simple; canal de soporte directo activo    |
| Sin rate limiting — riesgo de spam o trolls         | Bajo-Medio | Acceso solo por invitación; admin monitorea activamente |
| Server en localhost — sin URL pública todavía       | Alto       | **Bloqueante para el pilot. Resolver antes de invitar.** |
| /apoyo muestra "Próximamente" (falta ANTHROPIC_API_KEY) | Bajo    | Avisar a usuarios en el onboarding que la función no está activa |
| No hay "marcar como reunificado" en la UI del dueño | Medio      | El admin lo marca manualmente cuando el dueño lo reporta por otro canal |

---

## 6. Feedback a Recolectar

Preguntas para todos los usuarios al final del pilot (encuesta breve, 5–10 minutos):

**Sobre el flujo:**
- ¿Pudiste completar el formulario de reporte sin ayuda? ¿En qué paso tuviste dudas?
- ¿La información que pedimos es suficiente para describir tu perro, o faltó algo?
- ¿Recibiste una notificación cuando hubo un match? ¿Llegó rápido o tarde?
- ¿El contacto con el dueño/avistador fue fácil desde la app, o tuviste que salir a otro canal?

**Sobre la utilidad:**
- ¿Qué faltó que te hubiera ayudado más en el momento de pánico?
- ¿Volverías a usar la app si perdieras un perro?
- ¿La recomendarías a alguien que perdió un perro hoy?

**Sobre la confianza:**
- ¿Sentiste que la información de tu perro estaba en buenas manos?
- ¿Hubo algo que te generó desconfianza o incomodidad?

Recolectar respuestas por formulario (Google Form o similar) + una llamada corta con al menos 3–4 usuarios para profundizar.

---

## 7. Próximos Pasos Después del Pilot

Priorización condicional según lo que aprendamos:

### Si el flujo central funciona (gente llega al match y al contacto):
1. Desplegar a URL pública de producción
2. Integrar Cloudinary para imágenes persistentes
3. Integrar FCM para push notifications reales
4. Mapa en tiempo real de casos activos

### Si la UX tiene fricción (abandono en formularios, confusión):
1. Iterar formularios antes de escalar — prioridad sobre todo lo demás
2. Simplificar campos requeridos al mínimo viable
3. Agregar progress indicator en el flujo de reporte

### Si la calidad del matching es pobre (muchos MEDIUM irrelevantes):
1. Configurar OPENAI_API_KEY + REPLICATE_API_KEY para matching visual
2. Ajustar pesos del motor (actualmente: geo 40% / tiempo 20% / atributos 40%)
3. Evaluar agregar campo de "color dominante" como atributo clave

### Si /apoyo es pedida por usuarios:
1. Configurar ANTHROPIC_API_KEY y activar el endpoint
2. Prioridad media — el flujo core no depende de esto

### Siempre, independientemente de resultados:
- Rate limiting en formularios de reporte y avistamiento
- "Marcar como reunificado" accesible desde la UI del dueño
- Índice /reuniones con casos cerrados exitosamente (social proof)
- Revisión de política de moderación y tiempos de respuesta

---

*Documento interno — pilot controlado. No distribuir externamente.*
