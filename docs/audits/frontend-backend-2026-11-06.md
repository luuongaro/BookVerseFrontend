# Auditoría frontend–backend de BookVerse

**Fecha:** 06/11/2026. **Tipo:** revisión de código, contratos HTTP, rutas, servicios y pruebas automatizadas. No es una certificación de los deploys de Render/Vercel ni una prueba funcional de todas las pantallas.

## Versiones y alcance

- Frontend `develop`: `2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c` (incluye PR #94).
- Backend `develop`: `cc7903a89da49d515e737a15ceae0bf08016785b` (incluye PR #270, nuevas reglas de progreso).
- [Inventario completo: 112 operaciones en 23 controladores](backend-endpoints-2026-11-06.md).
- Se usaron copias aisladas de ambos repositorios. La copia de trabajo original del frontend tiene cambios locales; se preservaron y no se usaron como referencia de lo publicado.
- Se contrastaron controladores, validaciones de servicios Java, DTOs, rutas Angular, llamadas HTTP y consumidores en componentes. No se ejecutaron pagos, cambios de cuenta ni escrituras sobre datos de usuarios.

## Conclusión

Los módulos principales ya tienen interfaz: libros, búsqueda de Google Books, reseñas, historias, capítulos, biblioteca, lectores, perfiles, grupos, reportes y roles. Los faltantes más claros son **suscripciones**, **avance por capítulos de libros y grupos**, **restaurar reseñas moderadas**, **quitar lecturas de biblioteca**, **borrar comentarios** y **mostrar las obras publicadas de un autor desde su perfil**.

Antes de sumar pantallas hay que resolver una incompatibilidad reciente en el progreso de lectura. El frontend anterior acepta combinaciones que el backend actual rechaza. El fix está en el [PR #95](https://github.com/luuongaro/BookVerseFrontend/pull/95), rama `feature/reading-progress-contract`, separado de esta auditoría y del ajuste visual de apoyo a autores. Este informe no presupone que el PR esté mergeado.

## Cobertura por módulo

| Módulo             | Ya tiene interfaz                                                                                                                  | Qué queda                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Sesión             | Registro, login, recuperación, restablecimiento, guards, interceptor y aviso de sesión vencida                                     | Validación de integración con los tres roles y correo real; no se repitió durante esta auditoría                     |
| Books              | Catálogo paginado, detalle, importación desde Google Books, guardar en biblioteca                                                  | Acceso directo a grupos por libro y resumen de valoraciones como mejoras                                             |
| Google Books       | Búsqueda por texto/título/autor, importación, estado elegido al guardar                                                            | API propia sin parámetros de paginación/género; no prometer “todos los resultados” con cambios solo de frontend      |
| Biblioteca         | Libros e historias separados, filas por estado, scroll independiente, lápiz, porcentaje de libros                                  | Contrato de finalización, progreso por capítulos, quitar lectura                                                     |
| Stories / Chapters | Explorar historias ajenas, escritorio propio, CRUD de historias/capítulos, borradores, edición con formato y lectura               | Preservar estados finales/relectura al abrir capítulos; marcador de página persistente no está implementado          |
| Lectores / Perfil  | Buscar usuarios, visitar perfiles, avatar/portada, actividad, favoritos, editar cuenta y desactivarla                              | Mostrar historias publicadas del autor; no confundir favoritos con catálogo del autor                                |
| Grupos             | Lista, detalle, creación/edición, integrantes por usuario, expulsión desde edición, salida con traspaso, metas y progreso agregado | Avance propio en capítulos de grupos de libros y borrar/moderar comentarios                                          |
| Reseñas            | Consulta por obra, agrupación, filtros, paginación en cliente, crear/editar/borrar según permisos                                  | Integrar resúmenes de valoración del backend; paginación de servidor requiere evolución del backend                  |
| Reportes           | Reportar historias/reseñas, listado y aprobación/rechazo de moderación                                                             | Restauración de reseñas retiradas, ya disponible en backend                                                          |
| Roles / Cuentas    | Listado administrativo, asignación de roles, baja administrativa; cuenta propia editable                                           | Administración de suscripciones por usuario                                                                          |
| Apoyo a autores    | Inicio de checkout desde historia y perfil                                                                                         | Detalle/estado de un apoyo, cancelación pendiente y panel ADMIN; historial de usuario común requiere cambios backend |
| Suscripciones      | Solo archivos iniciales de componentes                                                                                             | Planes, mi plan, checkout Premium, sincronización y baja; todo el recorrido de usuario está pendiente                |

## Hallazgos prioritarios

### R1 — P1 — Estados y progreso no respetan el contrato actual

**Cómo se produce:** guardar un libro nuevo como Finalizado; cambiar una lectura con 40% a Finalizado; volver de Leyendo a Quiero leer; o guardar 100% manteniendo Leyendo. La UI anterior puede enviar progreso nulo, 40% con Finalizado, o progreso conservado con Quiero leer.

El backend exige que Quiero leer no tenga progreso, que Finalizado tenga progreso y, si se usa porcentaje, que sea 100%. También exige Finalizado al registrar 100%. Evidencia: [ReadingStatusServiceImpl.java:314](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/status/service/impl/ReadingStatusServiceImpl.java#L314), [ReadingStatusServiceImpl.java:607](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/status/service/impl/ReadingStatusServiceImpl.java#L607). El frontend base conservaba el par anterior o enviaba nulos: [library.service.ts:142](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/library/services/library.service.ts#L142), [library.service.ts:173](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/library/services/library.service.ts#L173).

**Fix preparado:** normalizar finalización a 100%, limpiar progreso al volver a Quiero leer, reiniciar el avance al pasar de Finalizado a una nueva lectura, y hacer visible Finalizado en el selector cuando se ingresa 100%. Preservar `progressTotal` cuando ya hay progreso por capítulos. El fix no agrega todavía el formulario de capítulos.

**Aceptación:** guardar Finalizado desde búsqueda, detalle y biblioteca debe enviar un payload válido; la pantalla confirma el estado devuelto por servidor; un error mantiene los datos anteriores.

### R2 — P1 — El lector puede sacar una historia de Finalizado o Releyendo

El lector compara contra `COMPLETED`, pero el enum del backend es `FINISHED`, y luego arma la actualización con `IN_PROGRESS` fijo. Abrir un capítulo de una historia terminada puede volverla a Leyendo; una relectura pierde su estado. Evidencia: [chapter-reader.ts:392](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/stories/pages/chapter-reader/chapter-reader.ts#L392), [ReadingStatusEnum.java:6](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/status/domain/ReadingStatusEnum.java#L6).

**Fix preparado:** no escribir progreso cuando ya está Finalizado y mantener Releyendo al avanzar capítulos. Pruebas específicas separadas de las pruebas antiguas del editor.

### R3 — P1 — Falta el flujo de progreso por capítulos para libros y grupos

El backend acepta `progressTotal` para progreso CHAPTER de libros, y lo exige en ese modo. No existe un tipo PAGE: los tipos reales son CHAPTER y PERCENTAGE. También existe `PUT /api/group-members/group/{groupId}/progress`, que guarda el avance del miembro según el total de capítulos del grupo. Son **dos referencias distintas**: total personal del libro y total acordado por el grupo.

El frontend solo permite porcentaje para libros. `GroupMember` no incluye `groupChapterProgress` ni `groupProgressUpdatedAt`, y `GroupMembersService` no llama al nuevo PUT. El progreso agregado de una meta CHAPTER de un grupo de libro usa precisamente ese campo del miembro; cambiar el porcentaje personal no lo sustituye. Evidencia: [ReadingStatusServiceImpl.java:274](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/status/service/impl/ReadingStatusServiceImpl.java#L274), [GroupMemberController.java:142](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/groups/groupMember/controller/GroupMemberController.java#L142), [GroupProgressServiceImpl.java:96](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/groups/groupProgress/service/impl/GroupProgressServiceImpl.java#L96), [group-member.model.ts:1](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/groups/models/group-member.model.ts#L1).

**Propuesta:** un PR para selector de modo y capítulo/total en biblioteca; otro para “Mi avance en este grupo”, con validación de membresía activa y referencia del grupo. Refrescar metas y avance luego de guardar. Las reglas de finalización por capítulos de libros deben confirmarse con Yan: el servicio actual valida rango/total, pero su regla explícita de último capítulo para Finalizado solo se aplica a historias.

### R4 — P1 — Suscripciones sin interfaz funcional

Hay ocho operaciones para planes, mi suscripción, checkout Premium, sincronización, baja y administración. Los componentes `plans` y `my-subscription` solo muestran `works!`; no están conectados a una ruta ni a un servicio de suscripciones. Evidencia: [SubscriptionController.java:74](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/subscriptions/controller/SubscriptionController.java#L74), [my-subscription.html:1](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/subscriptions/pages/my-subscription/my-subscription.html#L1), [app.routes.ts:19](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/app.routes.ts#L19).

**Propuesta en dos PRs:** planes/estado actual; luego checkout, regreso, sincronización y baja. No considerar que regresar del proveedor equivale a pago aprobado. Revisar con Yan cómo exponer estados de suscripción pendiente/activa y fecha de renovación: `/me` devuelve el plan, mientras el checkout incluye identificador y estado del alta. No inventar campos de DTO.

### R5 — P2 — No hay botón para quitar una lectura de la biblioteca

`DELETE /api/reading-statuses/{idExternal}` existe, pero no hay método ni acción de eliminación en la biblioteca. Evidencia: [ReadingStatusController.java:174](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/status/controller/ReadingStatusController.java#L174), [library.service.ts:36](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/library/services/library.service.ts#L36).

**Propuesta:** confirmación “Quitar de mi biblioteca”, retirar solo después del 204 y permitir volver a guardarla. Explicar que se elimina su registro de progreso. **Abandonados sigue fuera de los estantes por decisión del producto**; eso no sustituye eliminar el registro y no hay que reintroducir un estante de abandonados.

### R6 — P2 — Falta eliminar/moderar comentarios de grupos

La interfaz permite publicar y listar, pero el servicio frontend solo tiene esas dos operaciones. El backend permite eliminar al autor, ADMIN o MODERADOR y distingue baja propia de moderación. Evidencia: [GroupCommentServiceImpl.java:152](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/groups/groupComment/service/impl/GroupCommentServiceImpl.java#L152), [group-comments.service.ts:12](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/groups/services/group-comments.service.ts#L12).

**Propuesta:** acción contextual con permisos, confirmación y manejo de 403/404. No presentar los comentarios en grupos de historias como un faltante solo de frontend: el backend vigente los limita explícitamente a grupos de libros.

### R7 — P2 — Restaurar una reseña retirada no tiene interfaz

`PATCH /api/review-reports/{reportId}/restore` devuelve 204 y requiere MODERATOR o ADMIN. Solo restaura reseñas retiradas asociadas a un reporte aprobado que permite restauración; no recupera reseñas borradas por su autor. La UI y el servicio solo exponen aprobar/rechazar. Evidencia: [ReviewReportController.java:155](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/reviewReport/controller/ReviewReportController.java#L155), [review-reports.service.ts:12](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/reviews/services/review-reports.service.ts#L12).

**Propuesta:** botón y confirmación en moderación, recargar estado de reseña/reporte y manejar 400. La restauración modifica la reseña y no revierte el estado del reporte a PENDING. No extender esta acción a historias: no hay un endpoint equivalente de restauración de historias en el controlador auditado.

### R8 — P2 — El perfil no muestra las historias publicadas del autor

`getProfileStories()` existe pero no tiene consumidores fuera de su definición. El perfil muestra el contador de historias y favoritos, pero no una lista de obras de ese autor. Evidencia: [user.service.ts:141](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/profile/services/user.service.ts#L141), [UserProfileController.java:34](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/users/controller/UserProfileController.java#L34).

**Propuesta:** sección paginada “Historias publicadas” con enlaces al detalle. Usar este endpoint de perfil para respetar visibilidad y no cargar borradores desde las rutas del escritorio.

### R9 — P2 — Apoyos a autores: está el checkout, falta seguimiento

El frontend solo implementa `POST /api/tips`. El backend también tiene detalle, eliminar pendientes y listados administrativos. Los listados por emisor/receptor son **ADMIN**; no se pueden usar para un historial personal de usuarios comunes sin adaptar el backend. Evidencia: [TipController.java:144](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/tips/controller/TipController.java#L144), [TipController.java:216](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/tips/controller/TipController.java#L216), [tip.service.ts:12](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/tips/services/tip.service.ts#L12).

**Propuesta:** conservar el ID del apoyo al iniciar checkout, mostrar su estado al consultar el detalle y permitir cancelar solo pendientes según servidor. Un historial completo para autores/lectores requiere endpoints propios autenticados. La configuración de retorno del checkout de apoyos también requiere trabajo conjunto: la preferencia vigente no establece URLs de regreso en código. No crear una pantalla de “pago exitoso” que dé por aprobado el pago a partir de la URL.

**Ajuste visual solicitado en esta entrega:** se elimina la taza; botón “Apoyar al autor”, monto separado y estilo lavanda discreto. Se mantiene el monto y el mismo contrato de pago.

### R10 — P3 — Resúmenes de valoración disponibles pero sin consumir

Hay endpoints `rating-summary` por libro e historia, pero `ReviewsService` no los implementa. La UI calcula estadísticas desde las reseñas cargadas. No es correcto decir que hoy no existen valoraciones: ya se ven, aunque la fuente es el cálculo cliente. Evidencia: [ReviewController.java:196](https://github.com/luuongaro/BookVerseBackend/blob/cc7903a89da49d515e737a15ceae0bf08016785b/src/main/java/com/grupo3/BookVerse/features/reviews/controller/ReviewController.java#L196), [review-list.ts:187](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/reviews/pages/review-list/review-list.ts#L187).

**Propuesta:** integrar el resumen del servidor en la ficha/obra, conservando filtros del listado. La paginación de reseñas/reportes/grupos no se vuelve de servidor solo agregando controles: sus endpoints actuales devuelven listas.

### R11 — P3 — Accesos a grupos por obra sin usar

Los servicios frontend definen consultas de grupos por libro/historia, pero no tienen consumidores en pantallas. Ya existe exploración general de grupos: es una mejora de descubrimiento, no un módulo ausente. Agregar acceso desde el detalle de obra y reutilizar el listado con su contexto.

### R12 — P2 — Marcador del lector solo en memoria y posible carrera de identidad

`toggleBookmark()` cambia un signal local; el marcador se pierde al recargar. No hay endpoint de marcador persistente en los 23 controladores revisados. Si se quiere guardar página exacta o posición, requiere definición de producto y almacenamiento adicional; el progreso CHAPTER no es lo mismo que la página dentro del capítulo.

El lector además solicita el usuario y el capítulo en paralelo. Si el capítulo llega antes y todavía no hay usuario cargado, el registro de progreso sale sin guardar. Es una condición identificada en código, pendiente de prueba de integración con respuesta lenta. Evidencia: [chapter-reader.ts:315](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/stories/pages/chapter-reader/chapter-reader.ts#L315), [chapter-reader.ts:328](https://github.com/luuongaro/BookVerseFrontend/blob/2f0271b2f3f3b46a3814005cfbe74b1aa7bcad0c/BookVerseFrontend/src/app/features/stories/pages/chapter-reader/chapter-reader.ts#L328).

## Pruebas, calidad y límites de la validación

- `npm run build`: **OK** para la rama de auditoría/botón. Bundle inicial ~946 kB; advertencia de 500 kB, debajo del límite de error de 1 MB. El CSS de grupos ya no bloquea.
- `npm test -- --watch=false`: **bloqueado en compilación** por `group-members.spec.ts`: falta `totalChapters` en el fixture.
- Diagnóstico excluyendo temporalmente solo ese fixture, sin cambiar código productivo: **222 pruebas, 209 aprobadas y 13 fallidas en 5 archivos**. No es una suite completa aprobada.
- Fallos en `chapters.spec.ts` (4), `writer-desk.spec.ts` (2), `review-detail.spec.ts` (3), `review-list.spec.ts` (2) y `role-management.service.spec.ts` (2). Algunos son expectativas de texto/selector/ruta/argumentos anteriores; los de cálculo de valoraciones y publicación requieren confirmar comportamiento esperado antes de actualizar tests. Un test fallido no demuestra por sí solo un error visible de la aplicación.
- El test de roles usa un token de prueba sin formato JWT válido frente al patrón actual de `TokenService`; revisar el fixture y el interceptor, sin relajar la validación de sesión para hacer pasar la prueba.
- Pruebas puntuales del botón/perfil: **7 aprobadas** en 2 archivos, con configuración temporal que excluye el fixture roto.
- Fix de lectura separado: **91 pruebas aprobadas** en 7 archivos y build de producción OK (~947 kB iniciales). Incluye regresiones de payload y lectura de capítulos. Los mocks viejos aceptaban finalizaciones con progreso inválido; esas expectativas se corrigen contra el contrato Java inspeccionado.
- No se ejecutaron suites de backend ni pruebas en navegador/desktop/mobile en esta auditoría. La herramienta de navegador no está disponible en esta sesión. No se certifica el estado de producción ni la entrega real de correos.

## Qué no corresponde volver a desarrollar

No crear nuevas pantallas solo porque un endpoint no se usa: `/health`, webhooks de Mercado Pago, consultas alternativas de roles, lectura por ID y listas globales de capítulos tienen usos internos o ya están cubiertas por otras vistas. Tampoco listar como pendiente lo ya integrado: avatares compartidos, recuperación de contraseña, favoritos en perfil, roles, salida de grupo con traspaso, capítulos con formato y estantes por estado.

Los archivos iniciales `favorites-list works!` no significan que favoritos esté ausente: la función real vive en Perfil. Los componentes compartidos iniciales `error-message`/`confirmation-dialog` tampoco equivalen a que no haya manejo de errores o confirmaciones, porque las pantallas ya los implementan localmente.

## Orden propuesto de PRs

1. **Fix de contrato de lectura** (R1–R2 y preservación de `progressTotal`).
2. **Reparar y ejecutar la suite general**, comenzando por el fixture de grupos y clasificando los 13 fallos restantes.
3. **Avance por capítulos** personal y **avance de miembro del grupo** en PRs separados (R3).
4. **Planes y mi suscripción**, luego checkout/sincronización/baja (R4).
5. **Gestión cotidiana:** quitar de biblioteca, borrar comentarios, restaurar reseñas, cada flujo en su PR (R5–R7).
6. **Perfil de autor y apoyos:** obras publicadas; seguimiento de pagos con los ajustes backend necesarios (R8–R9).
7. **Mejoras de consulta y rendimiento:** resúmenes, grupos por obra, lazy loading y reducción del bundle (R10–R11).
8. **Definir marcador persistente** y probar la coordinación entre carga de usuario/capítulo (R12).

Todos los cambios deben validar carga, error, ausencia de resultados y permisos reales del backend. Para pagos y suscripciones, usar el entorno de prueba del proveedor; un checkout creado no es un pago aprobado.
