/**
 * Preguntas frecuentes de la landing. Se muestran en la página y se publican
 * igual en el JSON-LD (FAQPage): Google pide que lo marcado sea visible, y es
 * lo que más usan ChatGPT, Gemini y Perplexity para citar un producto.
 * Respuestas cortas, concretas y verdaderas: nada que el sistema no haga.
 */
export const PREGUNTAS = [
  {
    pregunta: "¿Qué es Tallerista?",
    respuesta:
      "Es un sistema de gestión para talleres mecánicos de Argentina. Ordena las órdenes de trabajo, los presupuestos, la agenda de turnos, los clientes con sus autos y la caja, y le avisa a cada cliente por WhatsApp. Lo desarrolla FAM Desarrollos.",
  },
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "Se prueba 7 días gratis, con todas las funciones, sin tarjeta y sin contrato. Si te sirve, el precio para seguir se acuerda en pesos por WhatsApp. Nada se cobra solo.",
  },
  {
    pregunta: "¿Hay que instalar algo?",
    respuesta:
      "No. Se usa desde el navegador del celular, la tablet o la compu. Si querés, en el celular se puede agregar a la pantalla de inicio y se abre como una app.",
  },
  {
    pregunta: "¿Cómo le llega el presupuesto a mi cliente?",
    respuesta:
      "Le mandás un link por WhatsApp desde tu número. Lo abre en el celular, ve cada repuesto con su precio y lo aprueba con un botón; vos te enterás en el momento. No tiene que descargar nada ni crear una cuenta.",
  },
  {
    pregunta: "¿Qué ve mi cliente de su auto?",
    respuesta:
      "Una ficha con todo lo que le hiciste, año por año, el kilometraje y cuánto le falta para el próximo service, con un botón para pedirte turno por WhatsApp.",
  },
  {
    pregunta: "¿Le sirve a mi contador? ¿Factura en ARCA?",
    respuesta:
      "Tallerista no emite facturas electrónicas: las órdenes son comprobantes internos. Lo que hace es armar cada mes una planilla de Excel con ventas, cobros y compras, tu CUIT y condición de IVA, la condición de cada cliente y qué factura le corresponde (A, B o C), para que tu contador facture en ARCA sin pedirte nada más.",
  },
  {
    pregunta: "¿Puedo sumar a mis mecánicos y a la recepción?",
    respuesta:
      "Sí. Le creás un usuario a cada uno, sin necesidad de email, y elegís su rol: administración, recepción, mecánico o contador. El mecánico ve sus trabajos y las tareas para tildar, pero no la plata.",
  },
  {
    pregunta: "¿Mis datos están seguros?",
    respuesta:
      "Cada taller ve solamente sus propios datos, la conexión es segura y cada persona entra con su usuario. Los links que reciben los clientes muestran sólo lo de su auto.",
  },
] as const;
