-- UnderBarber — datos iniciales. La aplicación lo ejecuta SOLO si la tabla barbers está vacía.
-- Los nombres de los barberos son de ejemplo: cámbialos desde el panel de administrador o aquí antes de desplegar.

INSERT INTO services (id, name, description, price, duration_min, position) VALUES
  (1, 'Corte clásico',        'Corte a tijera o máquina, lavado y peinado final.',                 30000, 30, 1),
  (2, 'Fade / degradado',     'Low, mid, high o skin fade con transición limpia y perfilado.',     40000, 45, 2),
  (3, 'Corte + barba',        'Corte completo más perfilado de barba con toalla caliente.',        55000, 60, 3),
  (4, 'Arreglo de barba',     'Perfilado, recorte y afeitado con navaja y aceites.',               25000, 30, 4),
  (5, 'Rizos y texturas',     'Corte para cabello rizado, ondulado o afro con definición.',        50000, 60, 5),
  (6, 'Diseño o color',       'Líneas, diseños, decoloración o color. Incluye corte.',             90000, 90, 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO barbers (id, display_name, title, specialty_key, bio, specialties, work_days, work_start, work_end, position) VALUES
  (1, 'Santiago "Santi" Rojas', 'Maestro del fade', 'fade',
   'Siete años perfeccionando degradados. Si quieres una transición limpia, líneas rectas y un look moderno y urbano, Santi es tu barbero.',
   ARRAY['Low fade','Mid fade','High fade','Skin fade','Taper','Estilo urbano'],
   ARRAY[1,2,3,4,5,6]::smallint[], '09:00', '19:00', 1),
  (2, 'Andrés Mejía', 'Clásico y barba', 'classic',
   'Barbería de la vieja escuela: tijera, navaja y toalla caliente. Especialista en cortes elegantes, peinados clásicos y barbas bien cuidadas.',
   ARRAY['Corte a tijera','Peinado clásico','Pompadour','Perfilado de barba','Afeitado con navaja','Look ejecutivo'],
   ARRAY[1,2,3,4,5,6]::smallint[], '10:00', '20:00', 2),
  (3, 'Camilo Vargas', 'Creativo y rizos', 'creative',
   'Le encanta salirse del molde: rizos, texturas, diseños, color y cabello largo. Ven con una idea loca y la hacemos realidad.',
   ARRAY['Rizos y afro','Texturas','Diseños y líneas','Coloración','Cabello largo','Mullet moderno'],
   ARRAY[2,3,4,5,6,7]::smallint[], '10:00', '20:00', 3)
ON CONFLICT (id) DO NOTHING;

-- Preguntas -------------------------------------------------------------------
INSERT INTO quiz_questions (id, position, text, help) VALUES
  (1, 1, '¿Qué estilo te representa más?',           'Piensa en cómo quieres que te vean.'),
  (2, 2, '¿Cómo quieres el largo de arriba?',        'La parte superior de la cabeza.'),
  (3, 3, '¿Cómo es tu cabello?',                     'Su textura natural.'),
  (4, 4, '¿Qué haces con la barba?',                 'Si tienes o quieres tener.'),
  (5, 5, '¿Qué te gustaría que tuviera tu corte?',   'Elige lo que más te llame la atención.'),
  (6, 6, '¿Cada cuánto vienes a la barbería?',       'Sé sincero, no pasa nada.')
ON CONFLICT (id) DO NOTHING;

-- Opciones (id = pregunta*10 + posición) ---------------------------------------
INSERT INTO quiz_options (id, question_id, position, label) VALUES
  (11, 1, 1, 'Moderno y urbano'),
  (12, 1, 2, 'Clásico y elegante'),
  (13, 1, 3, 'Atrevido y creativo'),

  (21, 2, 1, 'Muy corto o casi rapado'),
  (22, 2, 2, 'Corto o medio, bien peinado'),
  (23, 2, 3, 'Largo o con mucho volumen'),

  (31, 3, 1, 'Liso'),
  (32, 3, 2, 'Ondulado'),
  (33, 3, 3, 'Rizado o afro'),

  (41, 4, 1, 'No uso barba'),
  (42, 4, 2, 'La llevo corta y perfilada'),
  (43, 4, 3, 'La llevo larga y bien cuidada'),

  (51, 5, 1, 'Degradado limpio y transición suave'),
  (52, 5, 2, 'Corte a tijera, elegante y natural'),
  (53, 5, 3, 'Diseños, textura o color'),

  (61, 6, 1, 'Cada 1 o 2 semanas'),
  (62, 6, 2, 'Cada 3 o 4 semanas'),
  (63, 6, 3, 'Cuando se me acuerda')
ON CONFLICT (id) DO NOTHING;

-- Puntos: (opción, barbero, puntos). Barbero 1 = fade, 2 = clásico, 3 = creativo ------
INSERT INTO quiz_option_points (option_id, barber_id, points) VALUES
  (11, 1, 3), (11, 3, 1),
  (12, 2, 3), (12, 1, 1),
  (13, 3, 3), (13, 1, 1),

  (21, 1, 3), (21, 2, 1),
  (22, 2, 3), (22, 1, 1),
  (23, 3, 3), (23, 2, 1),

  (31, 1, 2), (31, 2, 2),
  (32, 2, 1), (32, 3, 2), (32, 1, 1),
  (33, 3, 3), (33, 1, 1),

  (41, 1, 1), (41, 3, 1),
  (42, 2, 2), (42, 1, 2),
  (43, 2, 3), (43, 3, 1),

  (51, 1, 3),
  (52, 2, 3),
  (53, 3, 3), (53, 1, 1),

  (61, 1, 2), (61, 2, 1),
  (62, 2, 2), (62, 3, 1),
  (63, 3, 2), (63, 2, 1)
ON CONFLICT (option_id, barber_id) DO NOTHING;

-- Dejar las secuencias después de los ids insertados a mano
SELECT setval(pg_get_serial_sequence('services', 'id'),       (SELECT max(id) FROM services));
SELECT setval(pg_get_serial_sequence('barbers', 'id'),        (SELECT max(id) FROM barbers));
SELECT setval(pg_get_serial_sequence('quiz_questions', 'id'), (SELECT max(id) FROM quiz_questions));
SELECT setval(pg_get_serial_sequence('quiz_options', 'id'),   (SELECT max(id) FROM quiz_options));
