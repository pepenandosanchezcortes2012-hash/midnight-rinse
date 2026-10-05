/**
 * Historia del bosque: seis hojas mojadas del registro de turnos anteriores y el tercer final.
 * Borrador de Gemini 3.8 Flash (Antigravity CLI), revisado y editado a mano para que encaje con las reglas y
 * mecánicas del juego (los filtros están adentro; él pregunta la hora cerca de las 04:00).
 */
(function (MR) {
  'use strict';

  MR.HISTORIA = {
    paginas: [
      { firma: 'Turno del 14 de octubre · R.',
        texto: 'Salí a tirar la basura y el estacionamiento ya no existía. Hay pinos altísimos pegados al cristal de la entrada y el olor a lluvia no viene de la calle. Juro que cuando checamos tarjeta a la una todavía había pavimento.' },
      { firma: 'Turno del 22 de octubre · E.',
        texto: 'Me escapé a fumar entre los árboles porque el zumbido del pasillo me estaba volviendo loco. En un claro encontré una lavadora blanca centrifugando sola, sin ningún cable. El tambor vibra caliente y huele a jabón fresco.' },
      { firma: 'Turno del 29 de octubre · S.',
        texto: 'El tipo del abrigo largo no solo se sienta en la banca amarilla. Lo vi parado detrás de un tronco grueso, mirándome fijo en la oscuridad. Cada vez que parpadeaba para enfocar la vista, aparecía dos metros más cerca.' },
      { firma: 'Turno del 6 de noviembre · D.',
        texto: 'Me acerqué a la máquina del bosque con la linterna para ver qué tenía dentro. La ropa que da vueltas lleva mi gafete bordado y la misma mancha de cloro en la manga. No quise tocar el cristal: sentí frío en el pecho, como si estuviera empapado.' },
      { firma: 'Turno del 12 de noviembre · T.',
        texto: 'El reloj no va a marcar las 05:12 jamás mientras estas hojas sigan regadas en el lodo. Cada turno fallido arrancó una página y alimentó la niebla de afuera. El local se queda con nuestras horas perdidas para no tener que apagar la luz nunca.' },
      { firma: 'Turno del 19 de noviembre · A.',
        texto: 'Si encontraste las seis hojas del registro, llévalas a la lavadora entre los pinos antes de las 05:12. Abre la tapa y mételas todas con el uniforme que gira. Es la única forma de cortar el ciclo. No dejes que te vea hacerlo.' }
    ],
    // Radio Nocturna 94.1 a las 02:40: una transmisión distinta por noche (la 1 es la original). Borrador de
    // Gemini 3.8 Flash, revisado. Después de la noche 8 solo queda estática.
    radio: [
      'Son las dos y cuarenta en Radio Nocturna, noventa y cuatro punto uno. Para quienes siguen despiertos: si esta noche alguien les pregunta la hora, respondan con cuidado.',
      'Son las dos y cuarenta en Radio Nocturna. Saludos a quien nos sintoniza entre el olor a jabón y centrifugados. No dejes que se apaguen los tambores; el silencio trae visitas.',
      'Son las dos y cuarenta en Radio Nocturna, bajo esta lluvia interminable. Si miras por el cristal, verás que los árboles crecieron demasiado cerca. Mejor concéntrate en fregar el pasillo.',
      'Son las dos y cuarenta aquí en Radio Nocturna. Me pregunto cuántos nombres caben en siete casilleros de metal oxidado. El tuyo ya estaba grabado antes de que llegaras, querido oyente.',
      'Son las dos y cuarenta en Radio Nocturna. Dicen que en el claro del bosque una máquina sin cable sigue lavando tu ropa. No vayas a buscarla; el zumbido tiene hambre esta noche.',
      'Son las dos y cuarenta en Radio Nocturna. Tu reloj siempre se rinde a las cinco y doce, pero la noche no termina ahí. Falta un minuto que nadie te pagará jamás.',
      'Son las dos y cuarenta en Radio Nocturna. Grábate bien este secreto: la hora verdadera son las cinco y trece. Si logras ver ese minuto en tu reloj, tal vez vuelvas a casa.',
      'Son las dos y cuarenta en Radio Nocturna, y esta es nuestra última transmisión para ti. Ya reconoces al hombre del abrigo, ¿verdad? Buen turno eterno, amigo; de aquí ya nadie sale.'
    ],
    // Radio Nocturna en vivo (game._bulletin): boletines cortos a otras horas, solo en la 94.1. Borrador de Gemini, revisado.
    boletines: {
      apertura: [
        'La una y cuarenta y cinco en Radio Nocturna. Saludos a quienes doblan sábanas o vigilan el agua esta noche. No están solos, aunque afuera no pase nadie.',
        'Comienza nuestro bloque de madrugada en la 94.1. Un saludo a los turnos solitarios de la avenida. El café sigue tibio y la noche apenas empieza a acomodarse.',
        'La una y cuarenta y cinco. Gracias por sintonizar la 94.1 junto al zumbido de las máquinas. Mantengan la luz encendida; aquí los acompañamos en la penumbra.'
      ],
      embalse: [
        'El reporte del embalse indica nueve centímetros de aumento. El agua ya roza la cruz del campanario de la vieja iglesia; pronto desaparecerá del todo.',
        'Boletín hidrológico: el embalse subió seis centímetros. En lo hondo, el viejo camino de la plaza quedó bajo otra capa de sedimentos fríos.',
        'Medición nocturna del embalse: cuatro centímetros más. El agua cubre los muros de la casa de válvulas; esas compuertas no se han movido desde 1986.',
        'El embalse ganó otros cinco centímetros en las últimas horas. Desde la torre de la iglesia hasta la casa de válvulas, todo reposa en absoluto silencio.'
      ],
      bus86: [
        'Nos informan que el autobús ochenta y seis con destino a Blackwood se detuvo hace un rato frente a la lavandería. En las ventanillas, todas las caras miraban hacia la misma vereda.',
        'El nocturno de la línea ochenta y seis a Blackwood hizo escala en la avenida. Si vieron abrirse sus puertas, recuerden que sus pasajeros no tienen prisa.',
        'Aviso de tránsito: el ochenta y seis hacia Blackwood esperó frente al negocio con el motor encendido. Los que bajaron no traían paraguas.'
      ],
      barredora: [
        'La barredora municipal pasó hace poco por la avenida con su baliza naranja parpadeando. Dejó el asfalto reluciente y húmedo, como si viniera del fondo del lago.',
        'Si escucharon los cepillos de la barredora a la una y cuarenta, no miren la calzada. El agua que esparce sobre la calle huele a río viejo.'
      ],
      puente: [
        'Nos avisan desde el bosque que la placa de bronce regresó a su baranda en el puente viejo. Alguien tuvo la gentileza de devolverle su nombre a Blackwood.',
        'El puente del sendero vuelve a tener su placa en el lugar correcto. Quienquiera que la haya puesto esta noche, muchas gracias. Hacía falta recordar dónde estamos.'
      ],
      cierre: [
        'Son las cuatro y media. Nuestro bloque nocturno se despide por hoy. Cuiden sus pasos al salir; el agua del embalse ya está rozando el cordón de la avenida.',
        'Cuatro y treinta en la 94.1. Apagamos micrófonos mientras el agua sube despacio sobre el pavimento. Si deben esperar adentro, procuren no mirar fijo al vidrio.',
        'Llegan las cuatro y media y cerramos la transmisión nocturna. El agua cubre los primeros escalones de la vereda. Buenas noches a los rezagados; mantengan los pies secos.'
      ]
    },
    // El teléfono público a las 03:50: una llamada distinta por noche, siempre con la instrucción que importa.
    // Desde la sexta noche, la voz es la tuya.
    telefono: [
      'No lo mires a la cara. Si te pregunta la hora... faltan cinco minutos para las seis. Faltan cinco minutos para las seis.',
      'Soy yo otra vez. No lo mires a la cara. Si te pregunta la hora, faltan cinco minutos para las seis. No le digas nada más.',
      'Ya estuviste aquí, ¿verdad? Se te nota en la voz. No lo mires a la cara. Faltan cinco minutos para las seis.',
      'No te quedes mucho frente al espejo del pasillo. Y si te pregunta la hora: faltan cinco minutos para las seis.',
      'Escucha, que se corta... no lo mires... faltan cinco minutos para las seis... las hojas... el claro...',
      'No lo mires a la cara. Faltan cinco minutos para las seis. Yo tampoco salí, ¿sabes? Sigo aquí, en el turno de antes.'
    ],
    // Al final de la transmisión de las 02:40, en las noches 3 a 6: una dedicatoria (y, si diste tu nombre, tu nombre
    // entre la estática).
    dedicatoria: 'Antes de irnos: esta va para alguien que sigue doblando ropa ajena a esta hora. Ya sabe quién es.',
    // Susurros (uno cambiado a mano para no empujar al jugador a una falta).
    susurros: [
      '…no levantes la vista…',
      '…gira sin corriente…',
      '…limpia el filtro rápido…',
      '…el abrigo huele a tierra…',
      '…no lo mires al rostro…',
      '…el agua viene turbia…',
      '…tapa el zumbido grave…',
      '…los árboles tocan el vidrio…',
      '…pregunta siempre lo mismo…',
      '…tu nombre ya estaba ahí…',
      '…cinco y doce para siempre…',
      '…la hora verdadera vendrá…',
      '…cinco y trece no llega…',
      '…el banco amarillo está frío…',
      '…siete ya se quedaron…',
      '…nadie vendrá a relevarte…'
    ],
    // Blackwood (aprobado por Yesda): las caras blancas y las órdenes de las máscaras negras. Borrador de Gemini
    // (agy), revisado contra CANON.md y lore_check.py.
    blackwood: {
      llegada: [
        'Las mangas pesan mucho cuando el agua no termina de salir.',
        'Traigo barro de la farmacia vieja en el dobladillo del pantalón.',
        'El agua del río nunca termina de soltar los abrigos.',
        'Buenas noches. Estas sábanas se quedaron frías desde el otoño de 1986.',
        'Las monedas están heladas, pero todavía sirven para la máquina tres.',
        'Huele a jabón dulce aquí adentro; afuera solo huele a represa.',
        'Caminé despacio por los pinos para no gotear en la entrada.',
        'La campana de la escuela sonó justo antes de que se llenara el valle.',
        'El uniforme de los domingos todavía conserva un poco de arena limpia.',
        'Solo vengo a escurrir el vestido antes de que aclare.',
        'Disculpe el charco en la entrada; las botas venían muy llenas.',
        'La radio de la noche siempre acompaña bien este ciclo de lavado.'
      ],
      tocar: [
        'No te preocupes por nosotros; solo esperamos a que termine el centrifugado.',
        'El agua del fondo está muy quieta; aquí hace más tibio.',
        'Aquel año guardamos la ropa limpia arriba, pero el lago subió igual.',
        'El gato Pelusa siempre huele la hierba empapada que traemos en los zapatos.',
        'No busques mi mirada; es mejor mirar el reflejo del tambor girando.',
        'La farmacia de don Pedro tenía este mismo aroma a detergente en polvo.',
        'Si escuchas un rumor hondo, no es la tubería; es el embalse respirando.',
        'Nos sentamos en el banco amarillo porque ahí no importa mojar.',
        'Déjalo girar despacio; ya no tenemos prisa por regresar a casa.',
        'El agua nunca volverá a estar clara, pero la ropa queda suave.'
      ],
      despedida: [
        'Gracias por el calor. El camino entre los pinos ya se cerró.',
        'Nos llevamos la ropa húmeda; abajo se seca a su propio tiempo.',
        'Que tengas un buen turno hasta que den las 05:12.',
        'La puerta de vidrio siempre abre fácil hacia el bosque.',
        'Ya está. Nos vemos cuando vuelva a llover.',
        'Cuida al gato Pelusa del viento que baja del lago.'
      ],
      // Conversación (tocar a una cara blanca): cuatro preguntas, tres respuestas posibles cada una. Gemini, revisado.
      charla: {
        preguntas: [['origen', '¿De dónde vienen?'], ['1986', '¿Qué pasó en 1986?'], ['el', '¿Conocen al hombre del sombrero?'], ['ropa', '¿Por qué su ropa nunca se seca?']],
        // Preguntas que solo aparecen si pasó algo (clientela.js, _extraQuestions). Borrador de Gemini, revisado.
        extra: [['pelusa', '¿Les cae bien Pelusa?'], ['vigia', '¿Quién las mira desde la otra vereda?'],
          ['placa', '¿Qué es esta placa del puente?'], ['manana', '¿Ustedes ven la mañana?']],
        'origen': [
          'Cruzamos el puente viejo bajo el agua, pasando la farmacia de don Pedro.',
          'De la plaza de Blackwood, donde la campana aún suena bajo el lodo.',
          'Del bosque tras el vidrio; cada vereda da vuelta y regresa a ti.'
        ],
        '1986': [
          'El agua cubrió despacio el pueblo y el reloj de la iglesia se apagó.',
          'Llegó el embalse en 1986 y nos dijeron que el agua nunca aclararía.',
          'La campana de la escuela sonó temprano. Los que nos quedamos ya no hablamos de eso.'
        ],
        'el': [
          'Camina por la orilla fría; dile que faltan cinco minutos para las seis.',
          'Llegó antes del agua. Si entra a preguntar la hora, no lo mires.',
          'Nunca trae ropa; a veces solo espera de pie frente a los casilleros.'
        ],
        'ropa': [
          'El lodo del fondo es terco; tus cuatro secadoras dan calor, nada más.',
          'El jabón huele dulce, pero el agua honda de Blackwood nunca se marcha.',
          'Sigue mojada desde 1986. Solo venimos por el rumor tibio de las lavadoras.'
        ],
        'pelusa': [
          'No nos tiene miedo. A veces huele a jabón seco y a ropa tibia.',
          'Nos recuerda a los gatos que dormían en la plaza antes de que lloviera tanto.',
          'Es suave. En el fondo del agua nada tiene un pelaje tan tibio.'
        ],
        'vigia': [
          'Es una vecina nuestra. Le gusta ver las luces encendidas y saber que alguien sigue despierto.',
          'No entra porque no trae ropa mojada. Solo quería despedirse de nosotros bajo la lluvia.',
          'A veces nos da tristeza la soledad de la calle antes de volver al fondo.'
        ],
        'placa': [
          'Pasando la puerta de vidrio, entre los árboles, hay un puente sin nombre sobre piedras secas.',
          'Cruza un río seco muy adentro del bosque. Olvidó quién era cuando le quitaron el bronce.',
          'Huele al lodo de abajo. Alguien la arrancó antes de que el embalse cubriera todo.'
        ],
        'manana': [
          'Para nosotros, el reloj de la iglesia se detuvo para siempre en 1986.',
          'Nos vamos antes de que aclare. La mañana es para los que viven arriba del agua.',
          'No. Solo conocemos el agua fría y la campana de la escuela que sigue sonando.'
        ],
        // Una vez por noche (a veces), antes de la charla: te piden una moneda para la secadora (clientela.js).
        moneda: {
          pide: '¿Tienes una moneda? La secadora no acepta las nuestras.',
          gracias: 'Gracias. Toma una de las nuestras; aquí no sirve para nada.',
          nada: 'No importa. Nuestra ropa no se va a secar de todos modos.'
        },
        'cierre': [
          'El agua sigue tibia. Gracias por no cerrar la puerta esta noche.',
          'Esperaremos a que termine el ciclo, sin mojarte el piso.',
          'La radio de la noche suena bien con el tambor girando despacio.',
          'Acaricia a Pelusa de nuestra parte antes de que termine tu turno.'
        ]
      },
      // El niño de cara blanca (clientela.js, _stepChild / touchChild). Borrador de Gemini, revisado.
      nino: {
        al_empleado: [
          'El gato ronronea si no me muevo.',
          'Aquí siempre huele a ropa calientita.',
          'A veces escucho el timbre del recreo.'
        ],
        entre: [
          ['¿Podemos quedarnos hasta que se caliente todo?', 'Solo hasta que termine el ciclo, mi amor.'],
          ['¿Pelusa me deja tocarle las orejas?', 'Despacio, cariño, a los gatos no les gusta el ruido.'],
          ['¿Mis calcetines amarillos ya están secos?', 'Pronto, mi cielo, no tardarán mucho más.'],
          ['¿Cuándo va a sonar la campana?', 'La escuela todavía está durmiendo, pequeño.'],
          ['La lluvia hace ruido en los vidrios.', 'No mires hacia afuera, quédate junto a mí.']
        ]
      },
      // Lo que se dicen dos caras blancas que lavan a la vez (clientela.js, _chatter). Borrador de Gemini, revisado.
      entre: [
        ['El 86 venía casi lleno esta noche, todos con el abrigo empapado.', 'Nadie dijo una palabra hasta doblar la curva del viejo muelle.'],
        ['Apoya las manos en la tapa, todavía guarda un poco de calor.', 'Se siente bien. El agua allá abajo nunca pierde ese frío pesado.'],
        ['A veces todavía creo escuchar la campana de la escuela.', 'Es solo el agua pasando entre las ramas del sauce grande.'],
        ['Pasamos frente a la farmacia de don Pedro antes de subir.', 'Los frascos siguen en los estantes, cubiertos de un limo suave.'],
        ['Cruzamos el puente viejo del bosque, el que no tiene río.', 'El río seco de abajo ya olvidó el sonido de los pasos.'],
        ['El reloj de la iglesia sigue parado, con el agua hasta las agujas.', 'Las agujas ya no se mueven entre las hierbas del fondo.'],
        ['Pelusa no se asusta de nosotros. Nunca se asustó.', 'Los animales saben que no venimos a molestar a nadie.'],
        ['En la 94.1 ponen música muy suave esta noche.', 'Apenas se oye entre el zumbido de los tambores.']
      ],
      ordenes: [
        'ORDEN N.º 01: A las 02:40, la radio del mostrador debe estar en la 94.1.',
        'ORDEN N.º 04: No abra los casilleros del uno al siete bajo ninguna circunstancia.',
        'ORDEN N.º 09: Si él pregunta la hora, responda únicamente que faltan cinco minutos para las seis.',
        'ORDEN N.º 12: Jamás mire el rostro del hombre de abrigo largo y sombrero.',
        'ORDEN N.º 15: Limpie el lodo del piso antes de que marquen las 03:00.',
        'ORDEN N.º 18: No intente seguir a ningún cliente más allá de la puerta de vidrio.',
        'ORDEN N.º 22: Mantenga las cuatro secadoras apagadas si escucha sonar la campana sumergida.',
        'ORDEN N.º 27: Ignore cualquier documento municipal que conserve sellos oficiales fechados en 1986.',
        'ORDEN N.º 31: Deje salir al gato Pelusa si rasca la puerta de vidrio.',
        'ORDEN N.º 36: No altere el nivel de agua en ninguna de las seis lavadoras.',
        'ORDEN N.º 40: Entregue las llaves y abandone el mostrador exactamente a las 05:12.',
        'ORDEN N.º 44: Recuerde que la verdadera hora de relevo no ocurre hasta las 05:13.'
      ]
    },
    // Final verdadero: la hora verdadera y las seis hojas, en la misma noche.
    verdadero: {
      titulo: '05:13 · Fin del turno',
      texto: 'Él ya no estaba para verlo. Metes las seis hojas en el tambor y la lavadora se detiene por primera vez. Cuando vuelves, la lavandería está a oscuras y el letrero dice CERRADO. Sobre el mostrador, el registro está en blanco. Afuera ya es de día. Por fin sales a la calle.'
    },
    final: {
      titulo: 'Último ciclo de lavado',
      texto: 'Metes las seis páginas empapadas en el tambor y la máquina traga la tinta disuelta con un crujido metálico. El zumbido grave se apaga de golpe junto con los pinos, devolviéndote al pavimento frío de la avenida. Tu reloj de pulsera por fin marca las 05:13.'
    }
  };
})(window.MR = window.MR || {});
